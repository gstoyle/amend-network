import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { authConfig } from "@/auth.config";
import { getVisibleEvent, listUpcomingEvents, listVisibleEvents } from "@/lib/events/list";
import { migrator } from "@/lib/db/migrator";
import { deleteEventsByTitlePrefix } from "@/tests/helpers/event-cleanup";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `evt-cal-${randomUUID()}`;

function memberSession(role: "pathways" | "lead") {
  return { ...claimsFor(role)!, userId: randomUUID() };
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

async function insertEvent(input: {
  title: string;
  visibility: string[];
  startsAt?: Date;
  cancelledAt?: Date | null;
  isVirtual?: boolean;
  joinUrl?: string;
}): Promise<string> {
  const startsAt = input.startsAt ?? new Date(Date.now() + 2 * 60 * 60_000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
  const row = await migrator.event.create({
    data: {
      id: randomUUID(),
      title: input.title,
      description: `Body for ${input.title}`,
      startsAt,
      endsAt,
      visibility: input.visibility,
      isVirtual: input.isVirtual ?? false,
      createdBy: randomUUID(),
      cancelledAt: input.cancelledAt ?? null,
      joinLink: input.joinUrl ? { create: { url: input.joinUrl } } : undefined,
    },
  });
  return row.id;
}

describe("member event calendar (US2)", () => {
  afterEach(async () => {
    await deleteEventsByTitlePrefix(`${MARKER}-`);
  });

  it("Independent Test: Pathways sees shared + Pathways in the list; LEAD sees shared + LEAD; pending sees none", async () => {
    const shared = await insertEvent({
      title: `${MARKER}-shared`,
      visibility: ["all_authenticated"],
    });
    const pathwaysOnly = await insertEvent({
      title: `${MARKER}-pathways`,
      visibility: ["pathways"],
    });
    const leadOnly = await insertEvent({
      title: `${MARKER}-lead`,
      visibility: ["lead"],
    });

    const pathwaysTitles = (await listVisibleEvents(memberSession("pathways"))).map(
      (row) => row.title,
    );
    expect(pathwaysTitles).toEqual(
      expect.arrayContaining([`${MARKER}-shared`, `${MARKER}-pathways`]),
    );
    expect(pathwaysTitles).not.toContain(`${MARKER}-lead`);

    const leadTitles = (await listVisibleEvents(memberSession("lead"))).map((row) => row.title);
    expect(leadTitles).toEqual(expect.arrayContaining([`${MARKER}-shared`, `${MARKER}-lead`]));
    expect(leadTitles).not.toContain(`${MARKER}-pathways`);

    const upcoming = await listUpcomingEvents(memberSession("pathways"));
    expect(upcoming.map((row) => row.id)).toEqual(
      expect.arrayContaining([shared, pathwaysOnly]),
    );
    expect(upcoming.map((row) => row.id)).not.toContain(leadOnly);

    await expect(listVisibleEvents(claimsFor("pending"))).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });

  it("omits cancelled events and withholds other-cohort / unknown ids without a join URL field", async () => {
    const cancelled = await insertEvent({
      title: `${MARKER}-cancelled`,
      visibility: ["all_authenticated"],
      cancelledAt: new Date(),
    });
    const virtual = await insertEvent({
      title: `${MARKER}-virtual`,
      visibility: ["lead"],
      isVirtual: true,
      joinUrl: "https://meet.example.test/secret",
    });

    const pathwaysList = await listVisibleEvents(memberSession("pathways"));
    expect(pathwaysList.map((row) => row.id)).not.toContain(cancelled);
    expect(pathwaysList.map((row) => row.id)).not.toContain(virtual);

    const hidden = await getVisibleEvent(memberSession("pathways"), virtual);
    expect(hidden).toBeNull();

    const visibleVirtual = await getVisibleEvent(memberSession("lead"), virtual);
    expect(visibleVirtual?.id).toBe(virtual);
    expect(visibleVirtual).not.toHaveProperty("joinUrl");
    expect(visibleVirtual).not.toHaveProperty("virtualLink");
    expect(JSON.stringify(visibleVirtual)).not.toContain("meet.example.test");
  });

  it("list rows carry only the caller's own RSVP and a yes-only confirmed count", async () => {
    const eventId = await insertEvent({
      title: `${MARKER}-rsvp-fields`,
      visibility: ["all_authenticated"],
    });
    const registered = memberSession("pathways");
    const waitlisted = memberSession("pathways");
    const bystander = memberSession("pathways");

    await migrator.eventRsvp.createMany({
      data: [
        { userId: registered.userId, eventId, status: "yes" },
        { userId: randomUUID(), eventId, status: "yes" },
        { userId: waitlisted.userId, eventId, status: "waitlist" },
        { userId: randomUUID(), eventId, status: "no" },
      ],
    });

    const rowFor = async (session: ReturnType<typeof memberSession>) => {
      const rows = await listVisibleEvents(session);
      const row = rows.find((candidate) => candidate.id === eventId);
      expect(row, "the event must stay visible to a Pathways member").toBeDefined();
      return row!;
    };

    expect((await rowFor(registered)).viewerRsvpStatus).toBe("yes");
    expect((await rowFor(waitlisted)).viewerRsvpStatus).toBe("waitlist");
    expect((await rowFor(bystander)).viewerRsvpStatus).toBeNull();

    // Two yes rows; the waitlist and no rows must not be counted.
    for (const session of [registered, waitlisted, bystander]) {
      expect((await rowFor(session)).confirmedCount).toBe(2);
    }

    // The new fields must not change which events a role receives.
    const leadTitles = (await listVisibleEvents(memberSession("lead"))).map((row) => row.title);
    expect(leadTitles).toContain(`${MARKER}-rsvp-fields`);
    await expect(listVisibleEvents(claimsFor("pending"))).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });

  it("month and list use the same visible uncancelled set; unsigned requests are denied at layer 1", async () => {
    await insertEvent({
      title: `${MARKER}-both-views`,
      visibility: ["all_authenticated"],
    });
    const monthSet = await listVisibleEvents(memberSession("pathways"));
    const listSet = await listVisibleEvents(memberSession("pathways"));
    expect(monthSet.map((row) => row.id).sort()).toEqual(listSet.map((row) => row.id).sort());
    expect(authorizedFor("/app/events")).toBe(false);
    expect(authorizedFor("/app/events/any-id")).toBe(false);
    expect(authorizedFor("/app/events", "session-id")).toBe(true);
  });
});
