import { migrator } from "@/lib/db/migrator";

export async function deleteEventsByTitlePrefix(prefix: string): Promise<void> {
  const like = `${prefix}%`;
  await migrator.$executeRaw`
    DELETE FROM event_rsvps
    WHERE event_id IN (SELECT id FROM events WHERE title LIKE ${like})
  `;
  await migrator.$executeRaw`
    DELETE FROM event_join_links
    WHERE event_id IN (SELECT id FROM events WHERE title LIKE ${like})
  `;
  await migrator.$executeRaw`
    DELETE FROM events WHERE title LIKE ${like}
  `;
}
