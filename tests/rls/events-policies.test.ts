import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";

const MARKER = `evt-rls-${randomUUID()}`;

function isRlsDenied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /row-level security policy|permission denied/i.test(message);
}

async function insertEvent(input: {
  title: string;
  visibility: string[];
  startsAt?: Date;
  endsAt?: Date;
  cancelledAt?: Date | null;
  capacity?: number | null;
  isVirtual?: boolean;
}): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  const startsAt = input.startsAt ?? new Date(now + 2 * 60 * 60_000);
  const endsAt = input.endsAt ?? new Date(startsAt.getTime() + 60 * 60_000);
  const visibilityLiteral = `{${input.visibility.join(",")}}`;
  await migrator.$executeRaw`
    INSERT INTO events (
      id, title, description, starts_at, ends_at, is_virtual, capacity, visibility,
      created_by, created_at, updated_at, cancelled_at
    ) VALUES (
      ${id}::uuid,
      ${input.title},
      ${"Body for " + input.title},
      ${startsAt},
      ${endsAt},
      ${input.isVirtual ?? false},
      ${input.capacity ?? null},
      ${visibilityLiteral}::text[],
      ${randomUUID()}::uuid,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      ${input.cancelledAt ?? null}
    )
  `;
  return id;
}

async function insertJoinLink(eventId: string, url = "https://meet.example.test/room"): Promise<void> {
  await migrator.$executeRaw`
    INSERT INTO event_join_links (event_id, url) VALUES (${eventId}::uuid, ${url})
  `;
}

async function insertRsvp(input: {
  userId: string;
  eventId: string;
  status: string;
  waitlistedAt?: Date | null;
}): Promise<void> {
  await migrator.$executeRaw`
    INSERT INTO event_rsvps (
      user_id, event_id, status, waitlisted_at, created_at, updated_at
    ) VALUES (
      ${input.userId}::uuid,
      ${input.eventId}::uuid,
      ${input.status},
      ${input.waitlistedAt ?? null},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
}

describe("events RLS (GUCs only, no requireRole) — contracts/rls-policies.md", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await migrator.$executeRaw`DELETE FROM event_rsvps WHERE event_id = ${id}::uuid`;
      await migrator.$executeRaw`DELETE FROM event_join_links WHERE event_id = ${id}::uuid`;
      await migrator.$executeRaw`DELETE FROM events WHERE id = ${id}::uuid`;
    }
    createdIds.length = 0;
  });

  it("events.virtual_link column does not exist", async () => {
    const tables = await migrator.$queryRaw<{ regclass: string | null }[]>`
      SELECT to_regclass('public.events')::text AS regclass
    `;
    expect(tables[0]?.regclass).toBe("events");
    const cols = await migrator.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'events'
        AND column_name = 'virtual_link'
    `;
    expect(cols).toEqual([]);
  });

  it("pathways selects all_authenticated and pathways uncancelled rows, not lead or cancelled", async () => {
    const shared = await insertEvent({ title: `${MARKER}-shared`, visibility: ["all_authenticated"] });
    const pathways = await insertEvent({ title: `${MARKER}-pathways`, visibility: ["pathways"] });
    const lead = await insertEvent({ title: `${MARKER}-lead`, visibility: ["lead"] });
    const both = await insertEvent({
      title: `${MARKER}-both`,
      visibility: ["pathways", "lead"],
    });
    const cancelled = await insertEvent({
      title: `${MARKER}-cancelled`,
      visibility: ["all_authenticated"],
      cancelledAt: new Date(),
    });
    createdIds.push(shared, pathways, lead, both, cancelled);

    const rows = await withRls(
      {
        userId: randomUUID(),
        programRole: "pathways",
        adminRole: "none",
        status: "active",
      },
      (tx) =>
        tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM events WHERE title LIKE ${`${MARKER}-%`}
        `,
    );
    const ids = rows.map((row) => row.id);
    expect(ids).toEqual(expect.arrayContaining([shared, pathways, both]));
    expect(ids).not.toContain(lead);
    expect(ids).not.toContain(cancelled);
  });

  it("pending and empty tokens select no events", async () => {
    const id = await insertEvent({
      title: `${MARKER}-pending`,
      visibility: ["all_authenticated"],
    });
    createdIds.push(id);
    const pending = await withRls(
      {
        userId: randomUUID(),
        programRole: "pathways",
        adminRole: "none",
        status: "pending",
      },
      (tx) => tx.$queryRaw<{ id: string }[]>`SELECT id FROM events WHERE id = ${id}::uuid`,
    );
    expect(pending).toEqual([]);
  });

  it("staff SELECT includes cancelled; member SELECT does not", async () => {
    const id = await insertEvent({
      title: `${MARKER}-staff-cancelled`,
      visibility: ["all_authenticated"],
      cancelledAt: new Date(),
    });
    createdIds.push(id);
    const member = await withRls(
      { userId: randomUUID(), programRole: "pathways", adminRole: "none", status: "active" },
      (tx) => tx.$queryRaw<{ id: string }[]>`SELECT id FROM events WHERE id = ${id}::uuid`,
    );
    expect(member).toEqual([]);
    const staff = await withRls(
      { userId: randomUUID(), programRole: "none", adminRole: "admin", status: "active" },
      (tx) => tx.$queryRaw<{ id: string }[]>`SELECT id FROM events WHERE id = ${id}::uuid`,
    );
    expect(staff.map((row) => row.id)).toEqual([id]);
  });

  it("pathways cannot INSERT events; admin and moderator can", async () => {
    const memberId = randomUUID();
    await expect(
      withRls(
        {
          userId: randomUUID(),
          programRole: "pathways",
          adminRole: "none",
          status: "active",
        },
        (tx) =>
          tx.$executeRaw`
            INSERT INTO events (
              id, title, description, starts_at, ends_at, is_virtual, visibility,
              created_by, created_at, updated_at
            ) VALUES (
              ${memberId}::uuid, ${`${MARKER}-member`}, 'b',
              CURRENT_TIMESTAMP + interval '2 hours', CURRENT_TIMESTAMP + interval '3 hours',
              false, '{all_authenticated}', ${randomUUID()}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
          `,
      ),
    ).rejects.toSatisfy(isRlsDenied);

    const adminId = randomUUID();
    createdIds.push(adminId);
    await withRls(
      {
        userId: randomUUID(),
        programRole: "none",
        adminRole: "admin",
        status: "active",
      },
      (tx) =>
        tx.$executeRaw`
          INSERT INTO events (
            id, title, description, starts_at, ends_at, is_virtual, visibility,
            created_by, created_at, updated_at
          ) VALUES (
            ${adminId}::uuid, ${`${MARKER}-admin`}, 'b',
            CURRENT_TIMESTAMP + interval '2 hours', CURRENT_TIMESTAMP + interval '3 hours',
            false, '{all_authenticated}', ${randomUUID()}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `,
    );

    const moderatorId = randomUUID();
    createdIds.push(moderatorId);
    await withRls(
      {
        userId: randomUUID(),
        programRole: "none",
        adminRole: "moderator",
        status: "active",
      },
      (tx) =>
        tx.$executeRaw`
          INSERT INTO events (
            id, title, description, starts_at, ends_at, is_virtual, visibility,
            created_by, created_at, updated_at
          ) VALUES (
            ${moderatorId}::uuid, ${`${MARKER}-mod`}, 'b',
            CURRENT_TIMESTAMP + interval '2 hours', CURRENT_TIMESTAMP + interval '3 hours',
            false, '{all_authenticated}', ${randomUUID()}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `,
    );
  });

  it("moderator still cannot INSERT announcements", async () => {
    await expect(
      withRls(
        {
          userId: randomUUID(),
          programRole: "none",
          adminRole: "moderator",
          status: "active",
        },
        (tx) =>
          tx.$executeRaw`
            INSERT INTO announcements (
              id, headline, body, activates_at, expires_at, visibility, dismissible,
              created_by, created_at, updated_at
            ) VALUES (
              ${randomUUID()}::uuid, ${`${MARKER}-ann`}, 'b',
              CURRENT_TIMESTAMP - interval '1 minute', CURRENT_TIMESTAMP + interval '1 hour',
              '{all_authenticated}', true, ${randomUUID()}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
          `,
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("pathways INSERT/UPDATE own RSVP on a visible event, not a LEAD-only event or another user", async () => {
    const userId = randomUUID();
    const otherUser = randomUUID();
    const visible = await insertEvent({
      title: `${MARKER}-rsvp-ok`,
      visibility: ["pathways"],
    });
    const leadOnly = await insertEvent({
      title: `${MARKER}-rsvp-lead`,
      visibility: ["lead"],
    });
    createdIds.push(visible, leadOnly);

    await withRls(
      { userId, programRole: "pathways", adminRole: "none", status: "active" },
      (tx) =>
        tx.$executeRaw`
          INSERT INTO event_rsvps (user_id, event_id, status, created_at, updated_at)
          VALUES (${userId}::uuid, ${visible}::uuid, 'yes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
    );
    await withRls(
      { userId, programRole: "pathways", adminRole: "none", status: "active" },
      (tx) =>
        tx.$executeRaw`
          UPDATE event_rsvps SET status = 'maybe', updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ${userId}::uuid AND event_id = ${visible}::uuid
        `,
    );

    await expect(
      withRls(
        { userId, programRole: "pathways", adminRole: "none", status: "active" },
        (tx) =>
          tx.$executeRaw`
            INSERT INTO event_rsvps (user_id, event_id, status, created_at, updated_at)
            VALUES (${userId}::uuid, ${leadOnly}::uuid, 'yes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
      ),
    ).rejects.toSatisfy(isRlsDenied);

    await expect(
      withRls(
        { userId, programRole: "pathways", adminRole: "none", status: "active" },
        (tx) =>
          tx.$executeRaw`
            INSERT INTO event_rsvps (user_id, event_id, status, created_at, updated_at)
            VALUES (${otherUser}::uuid, ${visible}::uuid, 'yes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
      ),
    ).rejects.toSatisfy(isRlsDenied);
  });

  it("join-link SELECT is Yes + window only; Maybe, too-early Yes, and other cohort get zero rows", async () => {
    const yesUser = randomUUID();
    const maybeUser = randomUUID();
    const earlyUser = randomUUID();
    const now = Date.now();
    const inWindow = await insertEvent({
      title: `${MARKER}-join-now`,
      visibility: ["pathways"],
      isVirtual: true,
      startsAt: new Date(now - 10 * 60_000),
      endsAt: new Date(now + 50 * 60_000),
    });
    const tooEarly = await insertEvent({
      title: `${MARKER}-join-later`,
      visibility: ["pathways"],
      isVirtual: true,
      startsAt: new Date(now + 90 * 60_000),
      endsAt: new Date(now + 150 * 60_000),
    });
    const leadOnly = await insertEvent({
      title: `${MARKER}-join-lead`,
      visibility: ["lead"],
      isVirtual: true,
      startsAt: new Date(now - 10 * 60_000),
      endsAt: new Date(now + 50 * 60_000),
    });
    createdIds.push(inWindow, tooEarly, leadOnly);
    await insertJoinLink(inWindow);
    await insertJoinLink(tooEarly);
    await insertJoinLink(leadOnly);
    await insertRsvp({ userId: yesUser, eventId: inWindow, status: "yes" });
    await insertRsvp({ userId: maybeUser, eventId: inWindow, status: "maybe" });
    await insertRsvp({ userId: earlyUser, eventId: tooEarly, status: "yes" });
    await insertRsvp({ userId: yesUser, eventId: leadOnly, status: "yes" });

    const yesNow = await withRls(
      { userId: yesUser, programRole: "pathways", adminRole: "none", status: "active" },
      (tx) =>
        tx.$queryRaw<{ event_id: string }[]>`
          SELECT event_id FROM event_join_links WHERE event_id = ${inWindow}::uuid
        `,
    );
    expect(yesNow.map((row) => row.event_id)).toEqual([inWindow]);

    const maybeNow = await withRls(
      { userId: maybeUser, programRole: "pathways", adminRole: "none", status: "active" },
      (tx) =>
        tx.$queryRaw<{ event_id: string }[]>`
          SELECT event_id FROM event_join_links WHERE event_id = ${inWindow}::uuid
        `,
    );
    expect(maybeNow).toEqual([]);

    const yesEarly = await withRls(
      { userId: earlyUser, programRole: "pathways", adminRole: "none", status: "active" },
      (tx) =>
        tx.$queryRaw<{ event_id: string }[]>`
          SELECT event_id FROM event_join_links WHERE event_id = ${tooEarly}::uuid
        `,
    );
    expect(yesEarly).toEqual([]);

    const pathwaysOnLead = await withRls(
      { userId: yesUser, programRole: "pathways", adminRole: "none", status: "active" },
      (tx) =>
        tx.$queryRaw<{ event_id: string }[]>`
          SELECT event_id FROM event_join_links WHERE event_id = ${leadOnly}::uuid
        `,
    );
    expect(pathwaysOnLead).toEqual([]);
  });

  it("direct EXECUTE event_visible_core and event_join_revealed is false for LEAD-only as Pathways", async () => {
    const leadOnly = await insertEvent({
      title: `${MARKER}-fn-lead`,
      visibility: ["lead"],
      isVirtual: true,
      startsAt: new Date(Date.now() - 10 * 60_000),
      endsAt: new Date(Date.now() + 50 * 60_000),
    });
    createdIds.push(leadOnly);
    await insertJoinLink(leadOnly);
    const userId = randomUUID();
    await insertRsvp({ userId, eventId: leadOnly, status: "yes" });

    const pathwaysCtx = {
      userId,
      programRole: "pathways" as const,
      adminRole: "none" as const,
      status: "active" as const,
    };
    const core = await withRls(pathwaysCtx, (tx) =>
      tx.$queryRaw<{ ok: boolean }[]>`
        SELECT event_visible_core(${leadOnly}::uuid) AS ok
      `,
    );
    expect(core[0]?.ok).toBe(false);

    const revealed = await withRls(pathwaysCtx, (tx) =>
      tx.$queryRaw<{ ok: boolean }[]>`
        SELECT event_join_revealed(${leadOnly}::uuid) AS ok
      `,
    );
    expect(revealed[0]?.ok).toBe(false);
  });
});
