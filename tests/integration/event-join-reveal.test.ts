import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import { getEventIcs } from "@/lib/events/ics";
import { getRevealedJoinUrl } from "@/lib/events/join-link";
import { getVisibleEvent } from "@/lib/events/list";
import { createEvent } from "@/lib/events/publish";
import { setEventRsvp } from "@/lib/events/rsvp";
import { deleteEventsByTitlePrefix } from "@/tests/helpers/event-cleanup";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `evt-join-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";
const JOIN_URL = "https://meet.example.test/room/lead-only-secret";

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
  return { email, session: { ...claimsFor(role)!, userId: id } };
}

describe("virtual join-link reveal (US7)", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await deleteEventsByTitlePrefix(`${MARKER}-`);
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  it("Independent Test: LEAD Yes sees the link only inside the last hour; Maybe and Pathways never do", async () => {
    const startsAt = new Date(Date.now() + 5 * 60 * 60_000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
    const created = await createEvent(adminSession(), {
      title: `${MARKER}-lead`,
      description: "LEAD virtual",
      visibility: ["lead"],
      startsAt,
      endsAt,
      isVirtual: true,
      joinUrl: JOIN_URL,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const leadYes = await createMember("lead");
    const leadMaybe = await createMember("lead");
    const pathways = await createMember("pathways");
    createdUserIds.push(leadYes.session.userId, leadMaybe.session.userId, pathways.session.userId);

    const beforeEarly = await mailBodies();
    expect(await setEventRsvp(leadYes.session, created.id, "yes", { ip: IP, userAgent: USER_AGENT })).toEqual({
      ok: true,
      status: "yes",
    });
    expect(await getVisibleEvent(leadYes.session, created.id, { trackView: false })).not.toBeNull();
    expect(await getRevealedJoinUrl(leadYes.session, created.id)).toBeNull();
    expect((await getEventIcs(leadYes.session, created.id))?.body).not.toContain(JOIN_URL);
    const earlyMail = (await mailBodies()).slice(beforeEarly.length);
    expect(earlyMail.some((body) => body.includes(JOIN_URL))).toBe(false);

    const inWindowStart = new Date(Date.now() - 30 * 60_000);
    await migrator.event.update({
      where: { id: created.id },
      data: {
        startsAt: inWindowStart,
        endsAt: new Date(Date.now() + 30 * 60_000),
      },
    });

    expect(await getRevealedJoinUrl(leadYes.session, created.id)).toBe(JOIN_URL);
    expect((await getEventIcs(leadYes.session, created.id))?.body).toContain(JOIN_URL);

    expect(await setEventRsvp(leadMaybe.session, created.id, "maybe", { ip: IP, userAgent: USER_AGENT })).toEqual({
      ok: true,
      status: "maybe",
    });
    expect(await getRevealedJoinUrl(leadMaybe.session, created.id)).toBeNull();
    expect((await getEventIcs(leadMaybe.session, created.id))?.body).not.toContain(JOIN_URL);

    expect(await getVisibleEvent(pathways.session, created.id, { trackView: false })).toBeNull();
    expect(await getRevealedJoinUrl(pathways.session, created.id)).toBeNull();
    expect(await getEventIcs(pathways.session, created.id)).toBeNull();

    const inWindowEvent = await createEvent(adminSession(), {
      title: `${MARKER}-lead-now`,
      description: "LEAD virtual now",
      visibility: ["lead"],
      startsAt: new Date(Date.now() - 20 * 60_000),
      endsAt: new Date(Date.now() + 40 * 60_000),
      isVirtual: true,
      joinUrl: JOIN_URL,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(inWindowEvent.ok).toBe(true);
    if (!inWindowEvent.ok) {
      return;
    }
    const beforeWindow = await mailBodies();
    expect(await setEventRsvp(leadYes.session, inWindowEvent.id, "yes", { ip: IP, userAgent: USER_AGENT })).toEqual({
      ok: true,
      status: "yes",
    });
    const windowMail = (await mailBodies()).slice(beforeWindow.length);
    expect(windowMail.some((body) => body.includes(JOIN_URL))).toBe(true);
  });
});
