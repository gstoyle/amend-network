import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { createAnnouncement, listAdminAnnouncements } from "@/lib/announcements/publish";
import { migrator } from "@/lib/db/migrator";
import { deleteAnnouncementsByHeadlinePrefix } from "@/tests/helpers/announcement-cleanup";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `ann-pub-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";

function adminSession() {
  return {
    ...claimsFor("admin")!,
    mfaEnabled: true,
    mfaSatisfied: true,
  };
}

describe("admin announcement publish (US1)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await deleteAnnouncementsByHeadlinePrefix(`${MARKER}-`);
    createdIds.length = 0;
  });

  it("MFA admin create writes a live row and one announcement_created", async () => {
    const result = await createAnnouncement(adminSession(), {
      headline: `${MARKER}-live`,
      body: "Hello **members**",
      visibility: ["all_authenticated"],
      activatesAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60 * 60_000),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    createdIds.push(result.id);
    const row = await migrator.announcement.findUnique({ where: { id: result.id } });
    expect(row?.headline).toBe(`${MARKER}-live`);
    expect(row?.deletedAt).toBeNull();
    const listed = await listAdminAnnouncements(adminSession(), { status: "active" });
    expect(listed.some((item) => item.id === result.id)).toBe(true);
    const audit = await migrator.auditLog.findMany({
      where: { action: "announcement_created", entityId: result.id, userAgent: USER_AGENT },
    });
    expect(audit).toHaveLength(1);
  });

  it("rejects HTML body, inverted window, unpaired CTA, and disallowed destination with no row", async () => {
    const before = await migrator.announcement.count({
      where: { headline: { startsWith: MARKER } },
    });

    const html = await createAnnouncement(adminSession(), {
      headline: `${MARKER}-html`,
      body: "Hello <script>x</script>",
      visibility: ["pathways"],
      activatesAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(html.ok).toBe(false);

    const inverted = await createAnnouncement(adminSession(), {
      headline: `${MARKER}-window`,
      body: "Body",
      visibility: ["pathways"],
      activatesAt: new Date(Date.now() + 60_000),
      expiresAt: new Date(),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(inverted.ok).toBe(false);

    const unpaired = await createAnnouncement(adminSession(), {
      headline: `${MARKER}-cta`,
      body: "Body",
      visibility: ["pathways"],
      activatesAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      ctaPrimaryLabel: "Go",
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(unpaired.ok).toBe(false);

    const badUrl = await createAnnouncement(adminSession(), {
      headline: `${MARKER}-js`,
      body: "Body",
      visibility: ["pathways"],
      activatesAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      ctaPrimaryLabel: "Go",
      ctaPrimaryUrl: "javascript:alert(1)",
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(badUrl.ok).toBe(false);

    const after = await migrator.announcement.count({
      where: { headline: { startsWith: MARKER } },
    });
    expect(after).toBe(before);
  });

  it("Moderator, Pathways, LEAD, and Pending cannot create", async () => {
    const input = {
      headline: `${MARKER}-deny`,
      body: "Body",
      visibility: ["all_authenticated"],
      activatesAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      ip: IP,
      userAgent: USER_AGENT,
    };
    for (const role of ["moderator", "pathways", "lead", "pending"] as const) {
      await expect(createAnnouncement(claimsFor(role), input)).rejects.toThrowError(
        AUTH_FAILURE_MESSAGE,
      );
    }
  });
});
