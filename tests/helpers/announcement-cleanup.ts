import { migrator } from "@/lib/db/migrator";

export async function deleteAnnouncementsByHeadlinePrefix(prefix: string): Promise<void> {
  const like = `${prefix}%`;
  await migrator.$executeRaw`
    DELETE FROM announcement_cta_clicks
    WHERE announcement_id IN (SELECT id FROM announcements WHERE headline LIKE ${like})
  `;
  await migrator.$executeRaw`
    DELETE FROM announcement_impressions
    WHERE announcement_id IN (SELECT id FROM announcements WHERE headline LIKE ${like})
  `;
  await migrator.$executeRaw`
    DELETE FROM announcement_dismissals
    WHERE announcement_id IN (SELECT id FROM announcements WHERE headline LIKE ${like})
  `;
  await migrator.$executeRaw`
    DELETE FROM announcements WHERE headline LIKE ${like}
  `;
}
