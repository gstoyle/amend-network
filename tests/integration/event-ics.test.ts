import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { authConfig } from "@/auth.config";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { encryptPii, hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";
import { env } from "@/lib/env";
import { getEventIcs } from "@/lib/events/ics";
import { createEvent } from "@/lib/events/publish";
import { setEventRsvp } from "@/lib/events/rsvp";
import { deleteEventsByTitlePrefix } from "@/tests/helpers/event-cleanup";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `evt-ics-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";
const JOIN_URL = "https://meet.example.test/room/ics-secret";
const ADDRESS = "100 Main Street";

function adminSession() {
  return {
    ...claimsFor("admin")!,
    mfaEnabled: true,
    mfaSatisfied: true,
  };
}

function authorizedFor(pathname: string, sessionId?: string): boolean {
  const callback = authConfig.callbacks?.authorized;
  if (!callback) {
    throw new Error("authorized callback missing");
  }
  return (
    callback({
      auth: sessionId ? { sessionId } : null,
      request: { nextUrl: { pathname } },
    } as never) === true
  );
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
  return { email, session: { ...claimsFor(role)!, userId: id } };
}

describe("event ICS download and Yes invite (US5)", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await deleteEventsByTitlePrefix(`${MARKER}-`);
    if (createdUserIds.length > 0) {
      await migrator.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  it("Independent Test: Pathways ICS has times and address without the join URL; Yes invite also omits it more than 1h before start", async () => {
    expect(authorizedFor("/app/events/any-id/ics")).toBe(false);
    expect(authorizedFor("/app/events/any-id/ics", "session-id")).toBe(true);
    await expect(getEventIcs(null, randomUUID())).rejects.toThrowError(AUTH_FAILURE_MESSAGE);

    const startsAt = new Date(Date.now() + 5 * 60 * 60_000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
    const created = await createEvent(adminSession(), {
      title: `${MARKER}-visible`,
      description: "Calendar file workshop",
      visibility: ["pathways"],
      startsAt,
      endsAt,
      location: ADDRESS,
      isVirtual: true,
      joinUrl: JOIN_URL,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const pathways = await createMember("pathways");
    const lead = await createMember("lead");
    createdUserIds.push(pathways.session.userId, lead.session.userId);

    const ics = await getEventIcs(pathways.session, created.id);
    expect(ics).not.toBeNull();
    expect(ics?.filename).toBe(`${created.id}.ics`);
    expect(ics?.body).toContain("BEGIN:VCALENDAR");
    expect(ics?.body).toContain(ADDRESS.replace(",", "\\,"));
    expect(ics?.body).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(ics?.body).toMatch(/DTEND:\d{8}T\d{6}Z/);
    expect(ics?.body).not.toContain(JOIN_URL);

    expect(await getEventIcs(lead.session, created.id)).toBeNull();
    expect(await getEventIcs(pathways.session, randomUUID())).toBeNull();

    const before = await mailBodies();
    expect(await setEventRsvp(pathways.session, created.id, "yes", { ip: IP, userAgent: USER_AGENT })).toEqual({
      ok: true,
      status: "yes",
    });
    const after = await mailBodies();
    expect(countMatching(after, pathways.email) - countMatching(before, pathways.email)).toBe(1);
    const newBodies = after.slice(before.length);
    expect(newBodies.some((body) => body.includes(JOIN_URL))).toBe(false);
    expect(newBodies.some((body) => body.includes(pathways.email))).toBe(true);
  });
});
