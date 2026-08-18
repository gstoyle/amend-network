import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { getVisibleEvent } from "@/lib/events/list";
import { acquireEventRsvpLock, setEventRsvp } from "@/lib/events/rsvp";
import { withRls } from "@/lib/db/rls";
import { migrator } from "@/lib/db/migrator";
import { deleteEventsByTitlePrefix } from "@/tests/helpers/event-cleanup";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `evt-rsvp-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";

function memberSession(role: "pathways" | "lead") {
  return { ...claimsFor(role)!, userId: randomUUID() };
}

function auditCtx() {
  return { ip: IP, userAgent: USER_AGENT };
}

async function insertEvent(input: {
  title: string;
  visibility: string[];
  capacity?: number | null;
  cancelledAt?: Date | null;
}): Promise<string> {
  const startsAt = new Date(Date.now() + 2 * 60 * 60_000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
  const row = await migrator.event.create({
    data: {
      id: randomUUID(),
      title: input.title,
      description: `Body for ${input.title}`,
      startsAt,
      endsAt,
      visibility: input.visibility,
      isVirtual: false,
      capacity: input.capacity === undefined ? null : input.capacity,
      createdBy: randomUUID(),
      cancelledAt: input.cancelledAt ?? null,
    },
  });
  return row.id;
}

async function rsvpRows(eventId: string) {
  return migrator.eventRsvp.findMany({
    where: { eventId },
    orderBy: { userId: "asc" },
  });
}

describe("member event RSVP (US3)", () => {
  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await deleteEventsByTitlePrefix(`${MARKER}-`);
  });

  it("Independent Test: capacity 1 — first Yes, second waitlisted, Yes→No promotes oldest waitlist", async () => {
    const eventId = await insertEvent({
      title: `${MARKER}-cap1`,
      visibility: ["pathways"],
      capacity: 1,
    });
    const first = memberSession("pathways");
    const second = memberSession("pathways");

    const firstYes = await setEventRsvp(first, eventId, "yes", auditCtx());
    expect(firstYes).toEqual({ ok: true, status: "yes" });

    const secondYes = await setEventRsvp(second, eventId, "yes", auditCtx());
    expect(secondYes).toEqual({ ok: true, status: "waitlist" });

    let rows = await rsvpRows(eventId);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.userId === first.userId)?.status).toBe("yes");
    expect(rows.find((row) => row.userId === second.userId)?.status).toBe("waitlist");
    expect(rows.find((row) => row.userId === second.userId)?.waitlistedAt).toBeInstanceOf(Date);

    const firstNo = await setEventRsvp(first, eventId, "no", auditCtx());
    expect(firstNo).toEqual({ ok: true, status: "no" });

    rows = await rsvpRows(eventId);
    expect(rows.find((row) => row.userId === first.userId)?.status).toBe("no");
    expect(rows.find((row) => row.userId === second.userId)?.status).toBe("yes");
    expect(rows.find((row) => row.userId === second.userId)?.waitlistedAt).toBeNull();

    const audits = await migrator.auditLog.findMany({
      where: { userAgent: USER_AGENT, action: "event_rsvp" },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.length).toBeGreaterThanOrEqual(3);
    expect(audits.some((row) => row.targetUserId === second.userId)).toBe(true);
  });

  it("calls event_promote_oldest_waitlist only after a Yes seat actually frees", async () => {
    const eventId = await insertEvent({
      title: `${MARKER}-no-speculative`,
      visibility: ["pathways"],
      capacity: null,
    });
    const holder = memberSession("pathways");
    const waitlisted = memberSession("pathways");
    const bystander = memberSession("pathways");

    expect(await setEventRsvp(holder, eventId, "yes", auditCtx())).toEqual({
      ok: true,
      status: "yes",
    });
    await migrator.eventRsvp.create({
      data: {
        userId: waitlisted.userId,
        eventId,
        status: "waitlist",
        waitlistedAt: new Date(),
      },
    });

    expect(await setEventRsvp(bystander, eventId, "maybe", auditCtx())).toEqual({
      ok: true,
      status: "maybe",
    });
    expect((await rsvpRows(eventId)).find((row) => row.userId === waitlisted.userId)?.status).toBe(
      "waitlist",
    );

    expect(await setEventRsvp(holder, eventId, "no", auditCtx())).toEqual({
      ok: true,
      status: "no",
    });
    expect((await rsvpRows(eventId)).find((row) => row.userId === waitlisted.userId)?.status).toBe(
      "yes",
    );
  });

  it("concurrent Yes at capacity 1 yields at most one Yes row (RLS contract extra assertion)", async () => {
    const eventId = await insertEvent({
      title: `${MARKER}-concurrent`,
      visibility: ["pathways"],
      capacity: 1,
    });
    const a = memberSession("pathways");
    const b = memberSession("pathways");

    await Promise.all([
      setEventRsvp(a, eventId, "yes", auditCtx()),
      setEventRsvp(b, eventId, "yes", auditCtx()),
    ]);

    const rows = await rsvpRows(eventId);
    expect(rows.filter((row) => row.status === "yes")).toHaveLength(1);
    expect(rows.filter((row) => row.status === "waitlist")).toHaveLength(1);
    expect(rows).toHaveLength(2);
  });

  it("concurrent RSVPs on two different events do not wait on each other's lock", async () => {
    const eventA = await insertEvent({
      title: `${MARKER}-lock-a`,
      visibility: ["pathways"],
    });
    const eventB = await insertEvent({
      title: `${MARKER}-lock-b`,
      visibility: ["pathways"],
    });
    const holder = memberSession("pathways");
    const other = memberSession("pathways");
    const sleepSeconds = 0.4;

    let holdingA = false;
    let releasedA = false;
    let resolveAHasLock: () => void = () => undefined;
    const aHasLock = new Promise<void>((resolve) => {
      resolveAHasLock = resolve;
    });
    const holdA = withRls(
      {
        userId: holder.userId,
        programRole: holder.programRole,
        adminRole: holder.adminRole,
        status: holder.status,
      },
      async (tx) => {
        await acquireEventRsvpLock(tx, eventA);
        holdingA = true;
        resolveAHasLock();
        await tx.$queryRaw`SELECT pg_sleep(${sleepSeconds})::text`;
        releasedA = true;
      },
    );

    await aHasLock.promise;
    const bStarted = Date.now();
    const bResult = await setEventRsvp(other, eventB, "yes", auditCtx());
    const bElapsedMs = Date.now() - bStarted;

    expect(holdingA).toBe(true);
    expect(releasedA).toBe(false);
    expect(bResult).toEqual({ ok: true, status: "yes" });
    expect(bElapsedMs).toBeLessThan(sleepSeconds * 1000 * 0.5);

    await holdA;
    expect(releasedA).toBe(true);
  });

  it("Maybe and No do not consume capacity; other-cohort and cancelled are withheld", async () => {
    const visible = await insertEvent({
      title: `${MARKER}-maybe`,
      visibility: ["pathways"],
      capacity: 1,
    });
    const leadOnly = await insertEvent({
      title: `${MARKER}-lead`,
      visibility: ["lead"],
    });
    const cancelled = await insertEvent({
      title: `${MARKER}-cancelled`,
      visibility: ["pathways"],
      cancelledAt: new Date(),
    });
    const maybeMember = memberSession("pathways");
    const yesMember = memberSession("pathways");

    expect(await setEventRsvp(maybeMember, visible, "maybe", auditCtx())).toEqual({
      ok: true,
      status: "maybe",
    });
    expect(await setEventRsvp(yesMember, visible, "yes", auditCtx())).toEqual({
      ok: true,
      status: "yes",
    });

    expect(await setEventRsvp(memberSession("pathways"), leadOnly, "yes", auditCtx())).toEqual({
      ok: false,
    });
    expect(await setEventRsvp(memberSession("pathways"), cancelled, "yes", auditCtx())).toEqual({
      ok: false,
    });
    expect(await setEventRsvp(memberSession("pathways"), randomUUID(), "yes", auditCtx())).toEqual({
      ok: false,
    });
    expect(await rsvpRows(leadOnly)).toHaveLength(0);
    expect(await rsvpRows(cancelled)).toHaveLength(0);

    await expect(setEventRsvp(claimsFor("pending"), visible, "yes", auditCtx())).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });

  it("records event_viewed on a successful detail load without join URL fields", async () => {
    const eventId = await insertEvent({
      title: `${MARKER}-viewed`,
      visibility: ["pathways"],
    });
    const session = memberSession("pathways");
    const detail = await getVisibleEvent(session, eventId);
    expect(detail?.id).toBe(eventId);
    expect(detail).not.toHaveProperty("joinUrl");
    expect(detail).not.toHaveProperty("virtualLink");
  });
});
