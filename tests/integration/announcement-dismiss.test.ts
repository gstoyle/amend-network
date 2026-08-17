import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { dismissAnnouncement } from "@/lib/announcements/dismiss";
import { listEligibleBanners } from "@/lib/announcements/list";
import { migrator } from "@/lib/db/migrator";
import { deleteAnnouncementsByHeadlinePrefix } from "@/tests/helpers/announcement-cleanup";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `ann-dis-${randomUUID()}`;

function memberSession(role: "pathways" | "lead" = "pathways") {
  return { ...claimsFor(role)!, userId: randomUUID() };
}

async function insertLive(input: {
  headline: string;
  visibility: string[];
  activatesAt?: Date;
  dismissible?: boolean;
}): Promise<string> {
  const row = await migrator.announcement.create({
    data: {
      id: randomUUID(),
      headline: input.headline,
      body: `Body for ${input.headline}`,
      visibility: input.visibility,
      activatesAt: input.activatesAt ?? new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60 * 60_000),
      dismissible: input.dismissible ?? true,
      createdBy: randomUUID(),
    },
  });
  return row.id;
}

describe("per-user announcement dismissal (US3)", () => {
  const createdIds: string[] = [];

  beforeAll(async () => {
    await deleteAnnouncementsByHeadlinePrefix("ann-");
  });

  afterEach(async () => {
    await deleteAnnouncementsByHeadlinePrefix(`${MARKER}-`);
    createdIds.length = 0;
  });

  it("dismissing one of two shown omits it and can free a cap slot; another user still sees it", async () => {
    const newest = await insertLive({
      headline: `${MARKER}-C`,
      visibility: ["pathways"],
      activatesAt: new Date(Date.now() - 10_000),
    });
    const oldest = await insertLive({
      headline: `${MARKER}-A`,
      visibility: ["pathways"],
      activatesAt: new Date(Date.now() - 30_000),
    });
    const middle = await insertLive({
      headline: `${MARKER}-B`,
      visibility: ["pathways"],
      activatesAt: new Date(Date.now() - 20_000),
    });
    createdIds.push(newest, oldest, middle);

    const userA = memberSession();
    const userB = memberSession();
    const first = await listEligibleBanners(userA);
    expect(first.map((row) => row.headline)).toEqual([`${MARKER}-C`, `${MARKER}-B`]);

    expect(await dismissAnnouncement(userA, newest)).toBe(true);
    expect(await dismissAnnouncement(userA, newest)).toBe(true);

    const after = await listEligibleBanners(userA);
    expect(after.map((row) => row.headline)).toEqual([`${MARKER}-B`, `${MARKER}-A`]);
    expect(after.map((row) => row.id)).not.toContain(newest);

    const other = await listEligibleBanners(userB);
    expect(other.map((row) => row.headline)).toEqual([`${MARKER}-C`, `${MARKER}-B`]);
  });

  it("non-dismissible and out-of-visibility ids withhold without creating a row", async () => {
    const locked = await insertLive({
      headline: `${MARKER}-locked`,
      visibility: ["all_authenticated"],
      dismissible: false,
    });
    const leadOnly = await insertLive({
      headline: `${MARKER}-lead`,
      visibility: ["lead"],
    });
    createdIds.push(locked, leadOnly);
    const session = memberSession("pathways");

    expect(await dismissAnnouncement(session, locked)).toBe(false);
    expect(await dismissAnnouncement(session, leadOnly)).toBe(false);
    expect(await dismissAnnouncement(session, randomUUID())).toBe(false);

    const rows = await migrator.announcementDismissal.findMany({
      where: { announcementId: { in: [locked, leadOnly] } },
    });
    expect(rows).toEqual([]);
  });

  it("pending cannot dismiss", async () => {
    const id = await insertLive({
      headline: `${MARKER}-pend`,
      visibility: ["all_authenticated"],
    });
    createdIds.push(id);
    await expect(dismissAnnouncement(claimsFor("pending"), id)).rejects.toThrowError(
      AUTH_FAILURE_MESSAGE,
    );
  });
});
