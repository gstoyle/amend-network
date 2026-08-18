import { hmacEmailLookup } from "@/lib/crypto/pii";
import { migrator } from "@/lib/db/migrator";

export const DIRECTORY_SEED_EMAILS = [
  "dir-pathways-title@local",
  "dir-pathways-hidden@local",
  "dir-pathways-unlisted@local",
  "dir-lead-doc@local",
] as const;

export async function deleteDirectoryRowsForUserIds(userIds: string[]): Promise<void> {
  if (userIds.length === 0) {
    return;
  }
  await migrator.$executeRaw`
    DELETE FROM directory_search_throttle WHERE user_id = ANY(${userIds}::uuid[])
  `;
  await migrator.$executeRaw`
    DELETE FROM directory_shown_titles WHERE user_id = ANY(${userIds}::uuid[])
  `;
  await migrator.$executeRaw`
    DELETE FROM directory_shown_docs WHERE user_id = ANY(${userIds}::uuid[])
  `;
  await migrator.$executeRaw`
    DELETE FROM directory_shown_emails WHERE user_id = ANY(${userIds}::uuid[])
  `;
  await migrator.$executeRaw`
    DELETE FROM directory_listings WHERE user_id = ANY(${userIds}::uuid[])
  `;
}

export async function deleteDirectorySeedUsers(): Promise<void> {
  const lookups = DIRECTORY_SEED_EMAILS.map((email) => hmacEmailLookup(email));
  const users = await migrator.user.findMany({
    where: { emailLookup: { in: lookups } },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  await deleteDirectoryRowsForUserIds(ids);
  if (ids.length > 0) {
    await migrator.user.deleteMany({ where: { id: { in: ids } } });
  }
}
