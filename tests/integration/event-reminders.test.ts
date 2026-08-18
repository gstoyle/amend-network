import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import { createEvent } from "@/lib/events/publish";
import { runEventReminders } from "@/lib/events/reminders";
import { setEventRsvp } from "@/lib/events/rsvp";
import { deleteEventsByTitlePrefix } from "@/tests/helpers/event-cleanup";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `evt-remind-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";
const JOIN_URL = "https://meet.example.test/room/reminder-secret";
const DAY_MS = 24 * 60 * 60_000;

function adminSession() {
  return {
    ...claimsFor("admin")!,
    mfaEnabled: true,
    mfaSatisfied: true,
  };
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

async function createMember(role: "pathways" | "lead" = "pathways") {
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
  return { email, session: { ...claimsFor(role)!, userId: id } };
}

describe("24h Yes reminders (US6)", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await deleteEventsByTitlePrefix(`${MARKER}-`);
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  it("Independent Test: frozen T−24h reminds current Yes once; Maybe and waitlist skip", async () => {
    const now = new Date("2026-08-17T18:00:00.000Z");
    const startsAt = new Date(now.getTime() + DAY_MS);
    const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
    const created = await createEvent(adminSession(), {
      title: `${MARKER}-window`,
      description: "Reminder workshop",
      visibility: ["all_authenticated"],
      startsAt,
      endsAt,
      capacity: 1,
      isVirtual: true,
      joinUrl: JOIN_URL,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const yesMember = await createMember();
    const maybeMember = await createMember();
    const waitlisted = await createMember();
    createdUserIds.push(yesMember.session.userId, maybeMember.session.userId, waitlisted.session.userId);

    expect(await setEventRsvp(yesMember.session, created.id, "yes", { ip: IP, userAgent: USER_AGENT })).toEqual({
      ok: true,
      status: "yes",
    });
    expect(await setEventRsvp(maybeMember.session, created.id, "maybe", { ip: IP, userAgent: USER_AGENT })).toEqual({
      ok: true,
      status: "maybe",
    });
    expect(await setEventRsvp(waitlisted.session, created.id, "yes", { ip: IP, userAgent: USER_AGENT })).toEqual({
      ok: true,
      status: "waitlist",
    });

    const before = await mailBodies();
    const firstPass = await runEventReminders(now);
    expect(firstPass.reminded).toBe(1);
    const afterFirst = await mailBodies();
    expect(countMatching(afterFirst, yesMember.email) - countMatching(before, yesMember.email)).toBe(1);
    expect(countMatching(afterFirst, maybeMember.email) - countMatching(before, maybeMember.email)).toBe(0);
    expect(countMatching(afterFirst, waitlisted.email) - countMatching(before, waitlisted.email)).toBe(0);
    const newBodies = afterFirst.slice(before.length);
    expect(newBodies.some((body) => body.includes(JOIN_URL))).toBe(false);

    const secondPass = await runEventReminders(now);
    expect(secondPass.reminded).toBe(0);
    const afterSecond = await mailBodies();
    expect(countMatching(afterSecond, yesMember.email)).toBe(countMatching(afterFirst, yesMember.email));
  });

  it("skips cancelled events and events outside the 24h window", async () => {
    const now = new Date("2026-08-17T18:00:00.000Z");
    const member = await createMember();
    createdUserIds.push(member.session.userId);

    const inWindow = await createEvent(adminSession(), {
      title: `${MARKER}-cancelled`,
      description: "Will cancel",
      visibility: ["all_authenticated"],
      startsAt: new Date(now.getTime() + DAY_MS),
      endsAt: new Date(now.getTime() + DAY_MS + 60 * 60_000),
      ip: IP,
      userAgent: USER_AGENT,
    });
    const tooSoon = await createEvent(adminSession(), {
      title: `${MARKER}-later`,
      description: "Too far out",
      visibility: ["all_authenticated"],
      startsAt: new Date(now.getTime() + DAY_MS + 60 * 60_000),
      endsAt: new Date(now.getTime() + DAY_MS + 2 * 60 * 60_000),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(inWindow.ok && tooSoon.ok).toBe(true);
    if (!inWindow.ok || !tooSoon.ok) {
      return;
    }

    await setEventRsvp(member.session, inWindow.id, "yes", { ip: IP, userAgent: USER_AGENT });
    await setEventRsvp(member.session, tooSoon.id, "yes", { ip: IP, userAgent: USER_AGENT });
    await migrator.event.update({
      where: { id: inWindow.id },
      data: { cancelledAt: now },
    });

    const before = await mailBodies();
    const result = await runEventReminders(now);
    expect(result.reminded).toBe(0);
    const after = await mailBodies();
    expect(countMatching(after, member.email)).toBe(countMatching(before, member.email));
  });
});
