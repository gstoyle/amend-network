import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { createEvent, listAdminEvents } from "@/lib/events/publish";
import { withRls } from "@/lib/db/rls";
import { migrator } from "@/lib/db/migrator";
import { deleteEventsByTitlePrefix } from "@/tests/helpers/event-cleanup";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `evt-pub-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";

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

describe("admin event publish (US1)", () => {
  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await deleteEventsByTitlePrefix(`${MARKER}-`);
  });

  it("Independent Test: Admin creates shared + Pathways-only; admin list has both; Pathways sees both; LEAD sees shared only; Pathways denied create; Moderator can create", async () => {
    const shared = await createEvent(adminSession(), {
      title: `${MARKER}-shared`,
      description: "Shared workshop",
      visibility: ["all_authenticated"],
      ...startsEnds(24),
      ip: IP,
      userAgent: USER_AGENT,
    });
    const pathwaysOnly = await createEvent(adminSession(), {
      title: `${MARKER}-pathways`,
      description: "Pathways workshop",
      visibility: ["pathways"],
      ...startsEnds(48),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(shared.ok).toBe(true);
    expect(pathwaysOnly.ok).toBe(true);
    if (!shared.ok || !pathwaysOnly.ok) {
      return;
    }

    const listed = await listAdminEvents(adminSession());
    const listedIds = listed.map((row) => row.id);
    expect(listedIds).toEqual(expect.arrayContaining([shared.id, pathwaysOnly.id]));

    const pathwaysRows = await withRls(
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
    expect(pathwaysRows.map((row) => row.id)).toEqual(
      expect.arrayContaining([shared.id, pathwaysOnly.id]),
    );

    const leadRows = await withRls(
      {
        userId: randomUUID(),
        programRole: "lead",
        adminRole: "none",
        status: "active",
      },
      (tx) =>
        tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM events WHERE title LIKE ${`${MARKER}-%`}
        `,
    );
    expect(leadRows.map((row) => row.id)).toContain(shared.id);
    expect(leadRows.map((row) => row.id)).not.toContain(pathwaysOnly.id);

    await expect(
      createEvent(claimsFor("pathways"), {
        title: `${MARKER}-member`,
        description: "nope",
        visibility: ["all_authenticated"],
        ...startsEnds(72),
        ip: IP,
        userAgent: USER_AGENT,
      }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);

    const asModerator = await createEvent(moderatorSession(), {
      title: `${MARKER}-mod`,
      description: "Moderator-authored",
      visibility: ["lead"],
      ...startsEnds(96),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(asModerator.ok).toBe(true);
  });

  it("MFA admin create writes a row, optional join-link, and one event_created", async () => {
    const result = await createEvent(adminSession(), {
      title: `${MARKER}-virtual`,
      description: "Hello **members**",
      visibility: ["all_authenticated"],
      ...startsEnds(12),
      isVirtual: true,
      joinUrl: "https://meet.example.test/room",
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const row = await migrator.event.findUnique({ where: { id: result.id } });
    expect(row?.title).toBe(`${MARKER}-virtual`);
    expect(row?.cancelledAt).toBeNull();
    const link = await migrator.eventJoinLink.findUnique({ where: { eventId: result.id } });
    expect(link?.url).toBe("https://meet.example.test/room");
    const audit = await migrator.auditLog.findMany({
      where: { action: "event_created", entityId: result.id, userAgent: USER_AGENT },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.metadata).not.toMatchObject({ title: expect.anything() });
  });

  it("rejects HTML description, inverted window, virtual without URL, and writes no row", async () => {
    const before = await migrator.event.count({
      where: { title: { startsWith: MARKER } },
    });

    const html = await createEvent(adminSession(), {
      title: `${MARKER}-html`,
      description: "Hello <script>x</script>",
      visibility: ["pathways"],
      ...startsEnds(2),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(html.ok).toBe(false);

    const inverted = await createEvent(adminSession(), {
      title: `${MARKER}-window`,
      description: "Body",
      visibility: ["pathways"],
      startsAt: new Date(Date.now() + 60_000),
      endsAt: new Date(),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(inverted.ok).toBe(false);

    const virtualNoUrl = await createEvent(adminSession(), {
      title: `${MARKER}-novirtual`,
      description: "Body",
      visibility: ["pathways"],
      ...startsEnds(3),
      isVirtual: true,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(virtualNoUrl.ok).toBe(false);

    const after = await migrator.event.count({
      where: { title: { startsWith: MARKER } },
    });
    expect(after).toBe(before);
  });

  it("Pathways, LEAD, and Pending cannot create; Admin can create while MFA is optional", async () => {
    const input = {
      title: `${MARKER}-deny`,
      description: "Body",
      visibility: ["all_authenticated"] as string[],
      ...startsEnds(4),
      ip: IP,
      userAgent: USER_AGENT,
    };
    for (const role of ["pathways", "lead", "pending"] as const) {
      await expect(createEvent(claimsFor(role), input)).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    }
    await expect(createEvent(claimsFor("admin"), input)).resolves.toMatchObject({ ok: true });
  });
});
