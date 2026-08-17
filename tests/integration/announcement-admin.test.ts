import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { updateAnnouncement, withdrawAnnouncement } from "@/lib/announcements/edit";
import { listEligibleBanners } from "@/lib/announcements/list";
import {
  createAnnouncement,
  listAdminAnnouncements,
} from "@/lib/announcements/publish";
import { migrator } from "@/lib/db/migrator";
import { deleteAnnouncementsByHeadlinePrefix } from "@/tests/helpers/announcement-cleanup";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `ann-adm-${randomUUID()}`;
const USER_AGENT = `vitest-${MARKER}`;
const IP = "127.0.0.1";

function adminSession() {
  return {
    ...claimsFor("admin")!,
    mfaEnabled: true,
    mfaSatisfied: true,
  };
}

function pathwaysSession() {
  return { ...claimsFor("pathways")!, userId: randomUUID() };
}

describe("admin announcement queue, edit, withdraw (US4)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    await deleteAnnouncementsByHeadlinePrefix(`${MARKER}-`);
    createdIds.length = 0;
  });

  it("filters scheduled, active, and expired derived status", async () => {
    const scheduled = await createAnnouncement(adminSession(), {
      headline: `${MARKER}-scheduled`,
      body: "Later",
      visibility: ["all_authenticated"],
      activatesAt: new Date(Date.now() + 60 * 60_000),
      expiresAt: new Date(Date.now() + 2 * 60 * 60_000),
      ip: IP,
      userAgent: USER_AGENT,
    });
    const active = await createAnnouncement(adminSession(), {
      headline: `${MARKER}-active`,
      body: "Now",
      visibility: ["all_authenticated"],
      activatesAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60 * 60_000),
      ip: IP,
      userAgent: USER_AGENT,
    });
    const expired = await createAnnouncement(adminSession(), {
      headline: `${MARKER}-expired`,
      body: "Past",
      visibility: ["all_authenticated"],
      activatesAt: new Date(Date.now() - 2 * 60 * 60_000),
      expiresAt: new Date(Date.now() - 60_000),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(scheduled.ok && active.ok && expired.ok).toBe(true);
    if (!scheduled.ok || !active.ok || !expired.ok) {
      return;
    }
    createdIds.push(scheduled.id, active.id, expired.id);

    const scheduledList = await listAdminAnnouncements(adminSession(), { status: "scheduled" });
    expect(scheduledList.some((row) => row.id === scheduled.id)).toBe(true);
    expect(scheduledList.some((row) => row.id === active.id)).toBe(false);

    const activeList = await listAdminAnnouncements(adminSession(), { status: "active" });
    expect(activeList.some((row) => row.id === active.id)).toBe(true);
    expect(activeList.some((row) => row.id === expired.id)).toBe(false);

    const expiredList = await listAdminAnnouncements(adminSession(), { status: "expired" });
    expect(expiredList.some((row) => row.id === expired.id)).toBe(true);
  });

  it("edit applies immediately and withdraw hides the banner from members", async () => {
    const created = await createAnnouncement(adminSession(), {
      headline: `${MARKER}-edit`,
      body: "Original",
      visibility: ["all_authenticated"],
      activatesAt: new Date(Date.now() + 60 * 60_000),
      expiresAt: new Date(Date.now() + 2 * 60 * 60_000),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    createdIds.push(created.id);

    const edited = await updateAnnouncement(adminSession(), created.id, {
      headline: `${MARKER}-edited`,
      body: "Updated",
      visibility: ["pathways"],
      activatesAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60 * 60_000),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(edited.ok).toBe(true);

    const memberSees = await listEligibleBanners(pathwaysSession());
    expect(memberSees.some((row) => row.id === created.id)).toBe(true);

    expect(
      await withdrawAnnouncement(adminSession(), created.id, { ip: IP, userAgent: USER_AGENT }),
    ).toBe(true);

    const afterWithdraw = await listEligibleBanners(pathwaysSession());
    expect(afterWithdraw.some((row) => row.id === created.id)).toBe(false);

    const withdrawnList = await listAdminAnnouncements(adminSession(), { status: "withdrawn" });
    expect(withdrawnList.some((row) => row.id === created.id)).toBe(true);

    const audit = await migrator.auditLog.findMany({
      where: { entityId: created.id, userAgent: USER_AGENT },
      orderBy: { createdAt: "asc" },
    });
    expect(audit.map((row) => row.action)).toEqual([
      "announcement_created",
      "announcement_edited",
      "announcement_deleted",
    ]);
  });

  it("Moderator cannot edit or withdraw", async () => {
    const created = await createAnnouncement(adminSession(), {
      headline: `${MARKER}-mod`,
      body: "Body",
      visibility: ["all_authenticated"],
      activatesAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60 * 60_000),
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    createdIds.push(created.id);
    await expect(
      updateAnnouncement(claimsFor("moderator"), created.id, {
        headline: `${MARKER}-mod-edit`,
        body: "Nope",
        visibility: ["all_authenticated"],
        activatesAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        ip: IP,
        userAgent: USER_AGENT,
      }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    await expect(
      withdrawAnnouncement(claimsFor("moderator"), created.id, { ip: IP, userAgent: USER_AGENT }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
  });
});
