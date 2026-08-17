import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { recordAnnouncementCtaClick } from "@/lib/announcements/cta";
import { listEligibleBanners } from "@/lib/announcements/list";
import { migrator } from "@/lib/db/migrator";
import { deleteAnnouncementsByHeadlinePrefix } from "@/tests/helpers/announcement-cleanup";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `ann-ana-${randomUUID()}`;

function pathwaysSession() {
  return { ...claimsFor("pathways")!, userId: randomUUID() };
}

describe("unique announcement analytics (US5 / SC-009)", () => {
  const createdIds: string[] = [];

  beforeAll(async () => {
    await deleteAnnouncementsByHeadlinePrefix("ann-");
  });

  afterEach(async () => {
    await deleteAnnouncementsByHeadlinePrefix(`${MARKER}-`);
    createdIds.length = 0;
  });

  it("two page loads insert one impression; primary then secondary click is one row with first slot", async () => {
    const row = await migrator.announcement.create({
      data: {
        id: randomUUID(),
        headline: `${MARKER}-cta`,
        body: "Click me",
        visibility: ["all_authenticated"],
        activatesAt: new Date(Date.now() - 1_000),
        expiresAt: new Date(Date.now() + 60 * 60_000),
        createdBy: randomUUID(),
        ctaPrimaryLabel: "Primary",
        ctaPrimaryUrl: "/app/resources",
        ctaSecondaryLabel: "Secondary",
        ctaSecondaryUrl: "https://example.com/help",
      },
    });
    createdIds.push(row.id);
    const session = pathwaysSession();

    await listEligibleBanners(session);
    await listEligibleBanners(session);
    const impressions = await migrator.announcementImpression.findMany({
      where: { userId: session.userId, announcementId: row.id },
    });
    expect(impressions).toHaveLength(1);

    const first = await recordAnnouncementCtaClick(session, row.id, "primary");
    expect(first).toBe("/app/resources");
    const second = await recordAnnouncementCtaClick(session, row.id, "secondary");
    expect(second).toBe("https://example.com/help");

    const clicks = await migrator.announcementCtaClick.findMany({
      where: { userId: session.userId, announcementId: row.id },
    });
    expect(clicks).toHaveLength(1);
    expect(clicks[0]?.slot).toBe("primary");
  });

  it("withholds CTA for a LEAD-only banner from Pathways", async () => {
    const row = await migrator.announcement.create({
      data: {
        id: randomUUID(),
        headline: `${MARKER}-lead`,
        body: "Lead only",
        visibility: ["lead"],
        activatesAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 60 * 60_000),
        createdBy: randomUUID(),
        ctaPrimaryLabel: "Go",
        ctaPrimaryUrl: "/app",
      },
    });
    createdIds.push(row.id);
    const destination = await recordAnnouncementCtaClick(pathwaysSession(), row.id, "primary");
    expect(destination).toBeNull();
    const clicks = await migrator.announcementCtaClick.findMany({
      where: { announcementId: row.id },
    });
    expect(clicks).toEqual([]);
  });
});
