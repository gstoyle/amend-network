import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listEligibleBanners } from "@/lib/announcements/list";
import type { SessionClaims } from "@/lib/auth/types";
import { migrator } from "@/lib/db/migrator";
import { cohortToken } from "@/lib/db/visibility";
import { getEventIcs } from "@/lib/events/ics";
import { getRevealedJoinUrl } from "@/lib/events/join-link";
import { getVisibleEvent, listVisibleEvents } from "@/lib/events/list";
import { setEventRsvp } from "@/lib/events/rsvp";
import { grantDownload } from "@/lib/resources/download";
import { getResource, listResources } from "@/lib/resources/list";
import { deleteAnnouncementsByHeadlinePrefix } from "@/tests/helpers/announcement-cleanup";
import {
  cleanupCohortFixtures,
  createCohort,
  createCohortMember,
  newCohortFixtures,
} from "@/tests/helpers/cohort-fixtures";
import { deleteEventsByTitlePrefix } from "@/tests/helpers/event-cleanup";

const MARKER = `cohort-content-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const CONTEXT = { ip: "127.0.0.1", userAgent: USER_AGENT };

function memberClaims(
  userId: string,
  programRole: "pathways" | "lead",
  cohortIds: string[],
): SessionClaims {
  return {
    sessionId: randomUUID(),
    userId,
    programRole,
    programRoles: [programRole],
    cohortIds,
    adminRole: "none",
    status: "active",
    mfaEnabled: false,
    mfaSatisfied: false,
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  };
}

describe("cohort-only content for members (014 US2, T027)", () => {
  const fixtures = newCohortFixtures("cohort-content");
  let april: SessionClaims;
  let sept: SessionClaims;
  let both: SessionClaims;
  let lead: SessionClaims;
  const resourceId = randomUUID();
  const eventId = randomUUID();
  const announcementId = randomUUID();

  beforeAll(async () => {
    const aprilId = await createCohort(fixtures, { label: "april", programRole: "pathways" });
    const septId = await createCohort(fixtures, { label: "sept", programRole: "pathways" });
    const leadId = await createCohort(fixtures, { label: "lead", programRole: "lead" });
    april = memberClaims(
      await createCohortMember(fixtures, { label: "april", programRole: "pathways", primaryCohortId: aprilId }),
      "pathways",
      [aprilId],
    );
    sept = memberClaims(
      await createCohortMember(fixtures, { label: "sept", programRole: "pathways", primaryCohortId: septId }),
      "pathways",
      [septId],
    );
    both = memberClaims(
      await createCohortMember(fixtures, {
        label: "both",
        programRole: "pathways",
        primaryCohortId: septId,
        extraCohortIds: [aprilId],
      }),
      "pathways",
      [septId, aprilId],
    );
    lead = memberClaims(
      await createCohortMember(fixtures, { label: "lead", programRole: "lead", primaryCohortId: leadId }),
      "lead",
      [leadId],
    );

    const visibility = [cohortToken(aprilId)];
    await migrator.resource.create({
      data: {
        id: resourceId,
        title: `${MARKER}-packing list`,
        previewText: "What to bring to Norway",
        thumbnailObjectKey: `resources/${resourceId}/thumb`,
        sourceLabel: "Amend",
        tags: [],
        fileObjectKey: `resources/${resourceId}/file`,
        fileSizeBytes: BigInt(1),
        fileMimeType: "application/pdf",
        visibility,
        uploadedBy: april.userId,
      },
    });
    await migrator.event.create({
      data: {
        id: eventId,
        title: `${MARKER}-briefing`,
        description: "Pre-trip briefing",
        startsAt: new Date(Date.now() + 30 * 60_000),
        endsAt: new Date(Date.now() + 90 * 60_000),
        isVirtual: true,
        visibility,
        createdBy: april.userId,
        joinLink: { create: { url: "https://example.com/briefing" } },
      },
    });
    await migrator.announcement.create({
      data: {
        id: announcementId,
        headline: `${MARKER}-flights`,
        body: "Flight times are confirmed.",
        visibility,
        activatesAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 60 * 60_000),
        createdBy: april.userId,
      },
    });
  });

  afterAll(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await migrator.resource.deleteMany({ where: { id: resourceId } });
    await deleteEventsByTitlePrefix(`${MARKER}-`);
    await deleteAnnouncementsByHeadlinePrefix(`${MARKER}-`);
    await cleanupCohortFixtures(fixtures);
  });

  it("resources: the cohort sees it labelled by name; another cohort of the same trip and LEAD do not", async () => {
    for (const claims of [april, both]) {
      const listed = await listResources(claims, { q: MARKER });
      expect(listed.map((item) => item.id)).toEqual([resourceId]);
      expect(listed[0]?.audience.label).toBe(`${fixtures.marker}-april only`);
      expect((await getResource(claims, resourceId))?.id).toBe(resourceId);
    }
    for (const claims of [sept, lead]) {
      expect(await listResources(claims, { q: MARKER })).toEqual([]);
      expect(await getResource(claims, resourceId)).toBeNull();
      expect(await grantDownload(claims, resourceId, CONTEXT)).toBeNull();
    }
  });

  it("events: list, detail, ICS, RSVP, and join link follow cohort membership", async () => {
    expect((await listVisibleEvents(april)).some((event) => event.id === eventId)).toBe(true);
    expect((await getVisibleEvent(april, eventId))?.audience.label).toBe(`${fixtures.marker}-april only`);
    expect(await getEventIcs(april, eventId)).not.toBeNull();
    expect(await setEventRsvp(april, eventId, "yes", CONTEXT)).toEqual({ ok: true, status: "yes" });
    expect(await getRevealedJoinUrl(april, eventId)).toBe("https://example.com/briefing");

    for (const claims of [sept, lead]) {
      expect((await listVisibleEvents(claims)).some((event) => event.id === eventId)).toBe(false);
      expect(await getVisibleEvent(claims, eventId)).toBeNull();
      expect(await getEventIcs(claims, eventId)).toBeNull();
      expect(await setEventRsvp(claims, eventId, "yes", CONTEXT)).toEqual({ ok: false });
      expect(await getRevealedJoinUrl(claims, eventId)).toBeNull();
    }
  });

  it("announcements: the banner shows only to the targeted cohort", async () => {
    const ids = async (claims: SessionClaims) => (await listEligibleBanners(claims)).map((b) => b.id);
    expect(await ids(april)).toContain(announcementId);
    expect(await ids(both)).toContain(announcementId);
    expect(await ids(sept)).not.toContain(announcementId);
    expect(await ids(lead)).not.toContain(announcementId);
  });
});
