import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { updateAnnouncement } from "@/lib/announcements/edit";
import { createAnnouncement } from "@/lib/announcements/publish";
import { migrator } from "@/lib/db/migrator";
import { cohortToken, VISIBILITY_COHORT_UNAVAILABLE_MESSAGE } from "@/lib/db/visibility";
import { updateEvent } from "@/lib/events/edit";
import { createEvent } from "@/lib/events/publish";
import { updateResource } from "@/lib/resources/edit";
import { deleteAnnouncementsByHeadlinePrefix } from "@/tests/helpers/announcement-cleanup";
import {
  cleanupCohortFixtures,
  createCohort,
  newCohortFixtures,
} from "@/tests/helpers/cohort-fixtures";
import { deleteEventsByTitlePrefix } from "@/tests/helpers/event-cleanup";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `cohort-targets-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";

function adminSession() {
  return { ...claimsFor("admin")!, mfaEnabled: true, mfaSatisfied: true };
}

describe("cohort targets on publish and edit (014 FR-008, T028)", () => {
  const fixtures = newCohortFixtures("cohort-targets");
  const unknown = cohortToken(randomUUID());
  let active: string;
  let archived: string;

  beforeAll(async () => {
    active = cohortToken(await createCohort(fixtures, { label: "active", programRole: "pathways" }));
    archived = cohortToken(
      await createCohort(fixtures, { label: "archived", programRole: "pathways", archived: true }),
    );
  });

  afterAll(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await deleteAnnouncementsByHeadlinePrefix(`${MARKER}-`);
    await deleteEventsByTitlePrefix(`${MARKER}-`);
    await migrator.resource.deleteMany({ where: { title: { startsWith: `${MARKER}-` } } });
    await cleanupCohortFixtures(fixtures);
  });

  function announcement(label: string, visibility: string[]) {
    return {
      headline: `${MARKER}-${label}`,
      body: "Packing list",
      visibility,
      activatesAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60 * 60_000),
      ip: IP,
      userAgent: USER_AGENT,
    };
  }

  function event(label: string, visibility: string[]) {
    return {
      title: `${MARKER}-${label}`,
      description: "Pre-trip briefing",
      visibility,
      startsAt: new Date(Date.now() + 24 * 60 * 60_000),
      endsAt: new Date(Date.now() + 25 * 60 * 60_000),
      ip: IP,
      userAgent: USER_AGENT,
    };
  }

  it("announcements: refuse unknown and newly added archived cohorts, keep an existing archived one", async () => {
    const refused = { ok: false, error: VISIBILITY_COHORT_UNAVAILABLE_MESSAGE };
    expect(await createAnnouncement(adminSession(), announcement("unknown", [unknown]))).toEqual(refused);
    expect(await createAnnouncement(adminSession(), announcement("archived", [archived]))).toEqual(refused);

    const created = await createAnnouncement(adminSession(), announcement("active", [active]));
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(
      await updateAnnouncement(adminSession(), created.id, announcement("active", [active, archived])),
    ).toEqual(refused);

    await migrator.announcement.update({ where: { id: created.id }, data: { visibility: [active, archived] } });
    expect(
      await updateAnnouncement(adminSession(), created.id, announcement("kept", [active, archived])),
    ).toEqual({ ok: true, id: created.id });
    expect(await migrator.announcement.count({ where: { headline: `${MARKER}-unknown` } })).toBe(0);
  });

  it("events: refuse unknown and newly added archived cohorts, keep an existing archived one", async () => {
    const refused = { ok: false, error: VISIBILITY_COHORT_UNAVAILABLE_MESSAGE };
    expect(await createEvent(adminSession(), event("unknown", [unknown]))).toEqual(refused);
    expect(await createEvent(adminSession(), event("archived", [archived]))).toEqual(refused);

    const created = await createEvent(adminSession(), event("active", [active]));
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(await updateEvent(adminSession(), created.id, event("active", [active, archived]))).toEqual(
      refused,
    );

    await migrator.event.update({ where: { id: created.id }, data: { visibility: [active, archived] } });
    expect(await updateEvent(adminSession(), created.id, event("kept", [active, archived]))).toEqual({
      ok: true,
      id: created.id,
    });
  });

  it("resources: edit refuses unknown and newly added archived cohorts, keeps an existing archived one", async () => {
    const id = randomUUID();
    await migrator.resource.create({
      data: {
        id,
        title: `${MARKER}-resource`,
        previewText: "Packing list",
        thumbnailObjectKey: `resources/${id}/thumb`,
        sourceLabel: "Amend",
        tags: [],
        fileObjectKey: `resources/${id}/file`,
        fileSizeBytes: BigInt(1),
        fileMimeType: "application/pdf",
        visibility: [active],
        uploadedBy: adminSession().userId,
      },
    });
    const edit = (visibility: string[]) =>
      updateResource(adminSession(), {
        resourceId: id,
        title: `${MARKER}-resource`,
        previewText: "Packing list",
        sourceLabel: "Amend",
        tags: [],
        visibility,
        ip: IP,
        userAgent: USER_AGENT,
      });
    const refused = { ok: false, error: VISIBILITY_COHORT_UNAVAILABLE_MESSAGE };

    expect(await edit([unknown])).toEqual(refused);
    expect(await edit([active, archived])).toEqual(refused);

    await migrator.resource.update({ where: { id }, data: { visibility: [active, archived] } });
    expect(await edit([active, archived])).toEqual({ ok: true, id });
  });
});
