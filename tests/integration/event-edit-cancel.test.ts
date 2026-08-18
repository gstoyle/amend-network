import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import { cancelEvent } from "@/lib/events/cancel";
import { updateEvent } from "@/lib/events/edit";
import { listVisibleEvents } from "@/lib/events/list";
import { createEvent } from "@/lib/events/publish";
import { setEventRsvp } from "@/lib/events/rsvp";
import { deleteEventsByTitlePrefix } from "@/tests/helpers/event-cleanup";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `evt-edit-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";
const JOIN_URL = "https://example.test/join/secret-room";
const NOTIFY_MESSAGE = "Please use the side entrance.";

function adminSession() {
  return {
    ...claimsFor("admin")!,
    mfaEnabled: true,
    mfaSatisfied: true,
  };
}

function moderatorSession() {
  return {
    ...claimsFor("moderator")!,
    mfaEnabled: true,
    mfaSatisfied: true,
  };
}

function startsEnds(hoursFromNow: number, durationHours = 1) {
  const startsAt = new Date(Date.now() + hoursFromNow * 60 * 60_000);
  const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60_000);
  return { startsAt, endsAt };
}

async function mailBodies(): Promise<string[]> {
  const dir = env().EMAIL_JSON_DIR ?? ".tmp/mail";
  try {
    const names = await readdir(dir);
    return Promise.all(names.map((name) => readFile(join(dir, name), "utf8")));
  } catch {
    return [];
  }
}

function countMatching(bodies: string[], ...needles: string[]): number {
  return bodies.filter((body) => needles.every((needle) => body.includes(needle))).length;
}

async function createMember(role: "pathways" | "lead") {
  const email = `${MARKER}-${role}-${randomUUID()}@example.test`;
  const id = randomUUID();
  await migrator.user.create({
    data: {
      id,
      emailLookup: hmacEmailLookup(email),
      emailEncrypted: encryptPii(email),
      passwordHash: "unused-test-hash",
      firstNameEncrypted: encryptPii("Test"),
      lastNameEncrypted: encryptPii("Member"),
      programRole: role,
      adminRole: "none",
      status: "active",
    },
  });
  return {
    email,
    session: { ...claimsFor(role)!, userId: id },
  };
}

describe("staff event edit and cancel (US4)", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await deleteEventsByTitlePrefix(`${MARKER}-`);
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  it("Independent Test: two Yes RSVPs, time-change notify, then cancel — both mailed twice; calendar omits cancelled", async () => {
    const window = startsEnds(48);
    const created = await createEvent(adminSession(), {
      title: `${MARKER}-independent`,
      description: "Workshop",
      visibility: ["all_authenticated"],
      ...window,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const first = await createMember("pathways");
    const second = await createMember("pathways");
    createdUserIds.push(first.session.userId, second.session.userId);

    expect(await setEventRsvp(first.session, created.id, "yes", { ip: IP, userAgent: USER_AGENT })).toEqual({
      ok: true,
      status: "yes",
    });
    expect(await setEventRsvp(second.session, created.id, "yes", { ip: IP, userAgent: USER_AGENT })).toEqual({
      ok: true,
      status: "yes",
    });

    const before = await mailBodies();
    const nextWindow = startsEnds(72);
    const edited = await updateEvent(adminSession(), created.id, {
      title: `${MARKER}-independent`,
      description: "Workshop",
      visibility: ["all_authenticated"],
      ...nextWindow,
      ip: IP,
      userAgent: USER_AGENT,
      notifyRsvps: true,
      notifyMessage: NOTIFY_MESSAGE,
    });
    expect(edited.ok).toBe(true);

    const cancelled = await cancelEvent(adminSession(), created.id, {
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(cancelled.ok).toBe(true);

    const after = await mailBodies();
    expect(countMatching(after, first.email, NOTIFY_MESSAGE)).toBe(
      countMatching(before, first.email, NOTIFY_MESSAGE) + 1,
    );
    expect(countMatching(after, second.email, NOTIFY_MESSAGE)).toBe(
      countMatching(before, second.email, NOTIFY_MESSAGE) + 1,
    );
    expect(countMatching(after, first.email) - countMatching(before, first.email)).toBe(2);
    expect(countMatching(after, second.email) - countMatching(before, second.email)).toBe(2);

    const audit = await migrator.auditLog.findMany({
      where: { userAgent: USER_AGENT, entityId: created.id },
      orderBy: { createdAt: "asc" },
    });
    expect(audit.some((row) => row.action === "event_edited")).toBe(true);
    expect(audit.some((row) => row.action === "event_cancelled")).toBe(true);

    const visible = await listVisibleEvents(first.session);
    expect(visible.map((row) => row.id)).not.toContain(created.id);

    const retained = await migrator.eventRsvp.findMany({ where: { eventId: created.id } });
    expect(retained).toHaveLength(2);
  });

  it("warns on capacity shrink and does not demote existing Yes", async () => {
    const created = await createEvent(adminSession(), {
      title: `${MARKER}-cap`,
      description: "Cap shrink",
      visibility: ["all_authenticated"],
      ...startsEnds(24),
      capacity: 2,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const first = await createMember("pathways");
    const second = await createMember("pathways");
    createdUserIds.push(first.session.userId, second.session.userId);
    await setEventRsvp(first.session, created.id, "yes", { ip: IP, userAgent: USER_AGENT });
    await setEventRsvp(second.session, created.id, "yes", { ip: IP, userAgent: USER_AGENT });

    const blocked = await updateEvent(adminSession(), created.id, {
      title: `${MARKER}-cap`,
      description: "Cap shrink",
      visibility: ["all_authenticated"],
      ...startsEnds(24),
      capacity: 1,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      return;
    }
    expect(blocked.error.toLowerCase()).toMatch(/capacity/);
    const stillYes = await migrator.eventRsvp.findMany({ where: { eventId: created.id } });
    expect(stillYes.every((row) => row.status === "yes")).toBe(true);

    const confirmed = await updateEvent(adminSession(), created.id, {
      title: `${MARKER}-cap`,
      description: "Cap shrink",
      visibility: ["all_authenticated"],
      ...startsEnds(24),
      capacity: 1,
      ip: IP,
      userAgent: USER_AGENT,
      confirmCapacityShrink: true,
    });
    expect(confirmed.ok).toBe(true);
    const afterConfirm = await migrator.eventRsvp.findMany({ where: { eventId: created.id } });
    expect(afterConfirm.every((row) => row.status === "yes")).toBe(true);

    const third = await createMember("pathways");
    createdUserIds.push(third.session.userId);
    expect(await setEventRsvp(third.session, created.id, "yes", { ip: IP, userAgent: USER_AGENT })).toEqual({
      ok: true,
      status: "waitlist",
    });
  });

  it("time-change and cancel mail omit the join URL; Pathways cannot edit or cancel", async () => {
    const created = await createEvent(adminSession(), {
      title: `${MARKER}-virtual`,
      description: "Online workshop",
      visibility: ["all_authenticated"],
      ...startsEnds(36),
      isVirtual: true,
      joinUrl: JOIN_URL,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const member = await createMember("pathways");
    createdUserIds.push(member.session.userId);
    await setEventRsvp(member.session, created.id, "maybe", { ip: IP, userAgent: USER_AGENT });

    const before = await mailBodies();
    await updateEvent(adminSession(), created.id, {
      title: `${MARKER}-virtual`,
      description: "Online workshop",
      visibility: ["all_authenticated"],
      ...startsEnds(40),
      isVirtual: true,
      joinUrl: JOIN_URL,
      ip: IP,
      userAgent: USER_AGENT,
      notifyRsvps: true,
    });
    await cancelEvent(moderatorSession(), created.id, { ip: IP, userAgent: USER_AGENT });
    const after = await mailBodies();
    const sent = after.length - before.length;
    expect(sent).toBeGreaterThanOrEqual(2);
    const newBodies = after.slice(before.length);
    expect(newBodies.some((body) => body.includes(JOIN_URL))).toBe(false);
    expect(newBodies.some((body) => body.includes(member.email))).toBe(true);

    await expect(
      updateEvent(claimsFor("pathways"), created.id, {
        title: `${MARKER}-virtual`,
        description: "nope",
        visibility: ["all_authenticated"],
        ...startsEnds(50),
        ip: IP,
        userAgent: USER_AGENT,
      }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(
      cancelEvent(claimsFor("lead"), created.id, { ip: IP, userAgent: USER_AGENT }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
  });
});
