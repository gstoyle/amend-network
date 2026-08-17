import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/requireRole";
import { listEligibleBanners } from "@/lib/announcements/list";
import { migrator } from "@/lib/db/migrator";
import { deleteAnnouncementsByHeadlinePrefix } from "@/tests/helpers/announcement-cleanup";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `ann-vis-${randomUUID()}`;

function memberSession(role: "pathways" | "lead") {
  return { ...claimsFor(role)!, userId: randomUUID() };
}

async function insertLive(input: {
  headline: string;
  visibility: string[];
  activatesAt?: Date;
  expiresAt?: Date;
  deletedAt?: Date | null;
}): Promise<string> {
  const row = await migrator.announcement.create({
    data: {
      id: randomUUID(),
      headline: input.headline,
      body: `Body for ${input.headline}`,
      visibility: input.visibility,
      activatesAt: input.activatesAt ?? new Date(Date.now() - 60_000),
      expiresAt: input.expiresAt ?? new Date(Date.now() + 60 * 60_000),
      createdBy: randomUUID(),
      deletedAt: input.deletedAt ?? null,
    },
  });
  return row.id;
}

describe("member announcement visibility (US2 / FR-012/FR-013)", () => {
  const createdIds: string[] = [];

  beforeAll(async () => {
    await deleteAnnouncementsByHeadlinePrefix("ann-");
  });

  afterEach(async () => {
    await deleteAnnouncementsByHeadlinePrefix(`${MARKER}-`);
    createdIds.length = 0;
  });

  it("caps three staggered Pathways banners at the most recently activated two", async () => {
    const newestActivate = await insertLive({
      headline: `${MARKER}-C`,
      visibility: ["pathways"],
      activatesAt: new Date(Date.now() - 10_000),
    });
    const oldestActivate = await insertLive({
      headline: `${MARKER}-A`,
      visibility: ["pathways"],
      activatesAt: new Date(Date.now() - 30_000),
    });
    const middleActivate = await insertLive({
      headline: `${MARKER}-B`,
      visibility: ["pathways"],
      activatesAt: new Date(Date.now() - 20_000),
    });
    createdIds.push(newestActivate, oldestActivate, middleActivate);

    const listed = await listEligibleBanners(memberSession("pathways"));
    expect(listed.map((row) => row.headline)).toEqual([`${MARKER}-C`, `${MARKER}-B`]);
    expect(listed).toHaveLength(2);
  });

  it("LEAD does not see Pathways-only live banners; Pathways does not see LEAD-only", async () => {
    const pathwaysOnly = await insertLive({
      headline: `${MARKER}-p-only`,
      visibility: ["pathways"],
    });
    const leadOnly = await insertLive({
      headline: `${MARKER}-l-only`,
      visibility: ["lead"],
    });
    const shared = await insertLive({
      headline: `${MARKER}-shared`,
      visibility: ["all_authenticated"],
    });
    createdIds.push(pathwaysOnly, leadOnly, shared);

    const pathwaysHeadlines = (await listEligibleBanners(memberSession("pathways"))).map(
      (row) => row.headline,
    );
    expect(pathwaysHeadlines).toEqual(
      expect.arrayContaining([`${MARKER}-p-only`, `${MARKER}-shared`]),
    );
    expect(pathwaysHeadlines).not.toContain(`${MARKER}-l-only`);

    const leadHeadlines = (await listEligibleBanners(memberSession("lead"))).map(
      (row) => row.headline,
    );
    expect(leadHeadlines).toEqual(expect.arrayContaining([`${MARKER}-l-only`, `${MARKER}-shared`]));
    expect(leadHeadlines).not.toContain(`${MARKER}-p-only`);
  });

  it("withholds scheduled, expired, and withdrawn banners", async () => {
    const scheduled = await insertLive({
      headline: `${MARKER}-scheduled`,
      visibility: ["all_authenticated"],
      activatesAt: new Date(Date.now() + 60 * 60_000),
      expiresAt: new Date(Date.now() + 2 * 60 * 60_000),
    });
    const expired = await insertLive({
      headline: `${MARKER}-expired`,
      visibility: ["all_authenticated"],
      activatesAt: new Date(Date.now() - 2 * 60 * 60_000),
      expiresAt: new Date(Date.now() - 60_000),
    });
    const withdrawn = await insertLive({
      headline: `${MARKER}-withdrawn`,
      visibility: ["all_authenticated"],
      deletedAt: new Date(),
    });
    createdIds.push(scheduled, expired, withdrawn);

    const headlines = (await listEligibleBanners(memberSession("pathways"))).map(
      (row) => row.headline,
    );
    expect(headlines).not.toContain(`${MARKER}-scheduled`);
    expect(headlines).not.toContain(`${MARKER}-expired`);
    expect(headlines).not.toContain(`${MARKER}-withdrawn`);
  });

  it("pending is denied and receives 0 banners", async () => {
    const shared = await insertLive({
      headline: `${MARKER}-pend`,
      visibility: ["all_authenticated"],
    });
    createdIds.push(shared);
    expect(() => requireRole(claimsFor("pending"))).toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(listEligibleBanners(claimsFor("pending"))).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });
});
