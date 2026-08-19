import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { loadAdminAnalytics } from "@/lib/admin-analytics/load";
import { migrator } from "@/lib/db/migrator";
import { AdminLeaderboards } from "@/components/admin-leaderboards";
import { claimsFor } from "@/tests/helpers/prd-matrix";
import { deleteEventsByTitlePrefix } from "@/tests/helpers/event-cleanup";

const MARKER = `lb-${randomUUID()}`;

function mfaAdmin() {
  return { ...claimsFor("admin")!, mfaSatisfied: true };
}

async function insertResource(title: string, downloadCount: number, deletedAt: Date | null = null): Promise<string> {
  const row = await migrator.resource.create({
    data: {
      id: randomUUID(),
      title,
      previewText: title,
      thumbnailObjectKey: "seed/thumb.png",
      sourceLabel: "Amend",
      tags: [],
      fileObjectKey: "seed/file.pdf",
      fileSizeBytes: BigInt(1024),
      fileMimeType: "application/pdf",
      visibility: ["all_authenticated"],
      downloadCount,
      uploadedBy: randomUUID(),
      deletedAt,
    },
  });
  return row.id;
}

async function insertEvent(title: string, cancelledAt: Date | null = null): Promise<string> {
  const row = await migrator.event.create({
    data: {
      id: randomUUID(),
      title,
      description: title,
      startsAt: new Date(Date.now() + 60_000),
      endsAt: new Date(Date.now() + 120_000),
      isVirtual: false,
      visibility: ["all_authenticated"],
      createdBy: randomUUID(),
      cancelledAt,
    },
  });
  return row.id;
}

async function insertYesRsvps(eventId: string, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await migrator.eventRsvp.create({
      data: {
        userId: randomUUID(),
        eventId,
        status: "yes",
      },
    });
  }
}

describe("admin analytics leaderboards (US3 / SC-005)", () => {
  const createdResourceIds: string[] = [];

  afterEach(async () => {
    await deleteEventsByTitlePrefix(`${MARKER}-`);
    if (createdResourceIds.length > 0) {
      await migrator.resource.deleteMany({ where: { id: { in: createdResourceIds } } });
      createdResourceIds.length = 0;
    }
  });

  it("Independent Test: lists only live ≥3 downloads and uncancelled ≥3 Yes, cap 10, omits below-k/withdrawn/cancelled titles, no thread list", async () => {
    const belowKTitles = [`${MARKER}-res-dl-one`, `${MARKER}-res-dl-two`];
    const qualifyingTitles: string[] = [];
    createdResourceIds.push(await insertResource(belowKTitles[0]!, 1));
    createdResourceIds.push(await insertResource(belowKTitles[1]!, 2));
    for (let count = 3; count <= 12; count += 1) {
      const title = `${MARKER}-res-dl-${String(count).padStart(2, "0")}`;
      qualifyingTitles.push(title);
      createdResourceIds.push(await insertResource(title, count));
    }
    const withdrawnTitle = `${MARKER}-res-withdrawn`;
    createdResourceIds.push(await insertResource(withdrawnTitle, 99, new Date()));

    const yes1Id = await insertEvent(`${MARKER}-evt-yes-one`);
    await insertYesRsvps(yes1Id, 1);
    const yes2Id = await insertEvent(`${MARKER}-evt-yes-two`);
    await insertYesRsvps(yes2Id, 2);
    for (let i = 0; i < 11; i += 1) {
      const title = `${MARKER}-evt-yes-${String(i).padStart(2, "0")}`;
      const eventId = await insertEvent(title);
      await insertYesRsvps(eventId, 3 + i);
    }
    const cancelledId = await insertEvent(`${MARKER}-evt-cancelled`, new Date());
    await insertYesRsvps(cancelledId, 20);

    const snap = await loadAdminAnalytics(mfaAdmin(), null);
    expect(snap.topResources.length).toBeLessThanOrEqual(10);
    expect(snap.topResources.every((row) => row.downloadCount >= 3)).toBe(true);
    const resourceTitles = snap.topResources.map((row) => row.title);
    expect(resourceTitles).not.toEqual(expect.arrayContaining(belowKTitles));
    expect(resourceTitles).not.toContain(withdrawnTitle);
    expect(resourceTitles.some((title) => title.startsWith(`${MARKER}-res-dl-`))).toBe(true);

    expect(snap.topEvents.length).toBeLessThanOrEqual(10);
    expect(snap.topEvents.every((row) => row.yesCount >= 3)).toBe(true);
    const eventTitles = snap.topEvents.map((row) => row.title);
    expect(eventTitles).not.toContain(`${MARKER}-evt-yes-one`);
    expect(eventTitles).not.toContain(`${MARKER}-evt-yes-two`);
    expect(eventTitles).not.toContain(`${MARKER}-evt-cancelled`);
    expect(eventTitles.some((title) => title.startsWith(`${MARKER}-evt-yes-`))).toBe(true);

    const html = renderToStaticMarkup(
      createElement(AdminLeaderboards, {
        topResources: snap.topResources,
        topEvents: snap.topEvents,
      }),
    );
    for (const title of belowKTitles) {
      expect(html).not.toContain(title);
    }
    expect(html).not.toContain(withdrawnTitle);
    expect(html).not.toContain(`${MARKER}-evt-yes-one`);
    expect(html).not.toContain(`${MARKER}-evt-yes-two`);
    expect(html).not.toContain(`${MARKER}-evt-cancelled`);
    expect(html).not.toMatch(/forum thread|thread ranking|flag count/i);
    const listedQualifying = qualifyingTitles.filter((title) => html.includes(title));
    expect(listedQualifying.length).toBeGreaterThan(0);
    expect(listedQualifying.length).toBeLessThanOrEqual(10);
  });

  it("UI k=3 omission: below-threshold rows are absent from the rendered list, not shown as 0", () => {
    const html = renderToStaticMarkup(
      createElement(AdminLeaderboards, {
        topResources: [
          { id: "00000000-0000-4000-8000-000000000001", title: `${MARKER}-shown-res`, downloadCount: 5 },
          { id: "00000000-0000-4000-8000-000000000002", title: `${MARKER}-hidden-res-2`, downloadCount: 2 },
        ],
        topEvents: [
          { id: "00000000-0000-4000-8000-000000000003", title: `${MARKER}-shown-evt`, yesCount: 4 },
          { id: "00000000-0000-4000-8000-000000000004", title: `${MARKER}-hidden-evt-2`, yesCount: 2 },
        ],
      }),
    );
    expect(html).toContain(`${MARKER}-shown-res`);
    expect(html).toContain("5");
    expect(html).toContain(`${MARKER}-shown-evt`);
    expect(html).toContain("4");
    expect(html).not.toContain(`${MARKER}-hidden-res-2`);
    expect(html).not.toContain(`${MARKER}-hidden-evt-2`);
    expect(html).not.toMatch(/hidden-res-2[\s\S]{0,40}0/);
    expect(html).not.toMatch(/hidden-evt-2[\s\S]{0,40}0/);
  });

  it("empty leaderboards show an empty state and no below-threshold titles", () => {
    const html = renderToStaticMarkup(
      createElement(AdminLeaderboards, {
        topResources: [],
        topEvents: [],
      }),
    );
    expect(html).toMatch(/no resources|no live resources|empty/i);
    expect(html).toMatch(/no events|no uncancelled events|empty/i);
    expect(html).not.toMatch(/downloadCount|yesCount/);
    expect(html).not.toMatch(/forum thread|thread ranking|flag count/i);
    expect(html).toMatch(/forum.*(?:not (?:available|built)|deferred)|deferred.*forum/i);
  });

  it("Moderator is denied leaderboard numbers", async () => {
    await expect(loadAdminAnalytics(claimsFor("moderator"), null)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });
});
