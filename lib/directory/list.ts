import type { Prisma } from "@prisma/client";
import { track } from "@/lib/analytics/track";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { decryptPii } from "@/lib/crypto/pii";
import { withRls } from "@/lib/db/rls";
import { consumeDirectorySearch, DIRECTORY_SEARCH_TRY_LATER } from "@/lib/directory/throttle";

const QUERY_MAX = 200;
const QUERY_TOO_LONG = "Search is too long. Shorten it and try again.";

export type DirectoryMember = {
  id: string;
  displayName: string;
  networkLabel: string;
  initials: string;
  title?: string;
  docLabel?: string;
  email?: string;
};

export type DirectoryListInput = {
  q?: string;
  clientProgramRole?: unknown;
  clientAdminRole?: unknown;
};

export type DirectoryListResult =
  | { ok: true; members: DirectoryMember[] }
  | { ok: false; error: string };

export type SearchableMember = {
  firstName: string;
  lastName: string;
  networkLabel: string;
  title?: string;
  docLabel?: string;
};

type DecryptedListing = SearchableMember & {
  id: string;
  email?: string;
};

type ListingRow = {
  userId: string;
  networkId: string;
  firstNameEncrypted: Uint8Array;
  lastNameEncrypted: Uint8Array;
};

export function memberMatchesQuery(member: SearchableMember, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  const haystacks = [
    member.firstName,
    member.lastName,
    `${member.firstName} ${member.lastName}`,
    member.networkLabel,
  ];
  if (member.title !== undefined) {
    haystacks.push(member.title);
  }
  if (member.docLabel !== undefined) {
    haystacks.push(member.docLabel);
  }
  return haystacks.some((field) => field.toLowerCase().includes(needle));
}

function initials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase();
}

function toMember(row: DecryptedListing): DirectoryMember {
  const member: DirectoryMember = {
    id: row.id,
    displayName: `${row.firstName} ${row.lastName}`.trim(),
    networkLabel: row.networkLabel,
    initials: initials(row.firstName, row.lastName),
  };
  if (row.title) {
    member.title = row.title;
  }
  if (row.docLabel) {
    member.docLabel = row.docLabel;
  }
  if (row.email) {
    member.email = row.email;
  }
  return member;
}

export type HydratedListing = DecryptedListing;

export async function hydrateDirectoryListings(
  tx: Prisma.TransactionClient,
  listings: ListingRow[],
): Promise<HydratedListing[]> {
  if (listings.length === 0) {
    return [];
  }
  const ids = listings.map((row) => row.userId);
  const networkIds = [...new Set(listings.map((row) => row.networkId))];
  const [titles, docs, emails, networks] = await Promise.all([
    tx.directoryShownTitle.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, titleEncrypted: true },
    }),
    tx.directoryShownDoc.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, docAffiliationIdEncrypted: true },
    }),
    tx.directoryShownEmail.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, emailEncrypted: true },
    }),
    tx.network.findMany({
      where: { id: { in: networkIds } },
      select: { id: true, name: true },
    }),
  ]);
  const titleByUser = new Map(
    titles.map((row) => [row.userId, decryptPii(row.titleEncrypted)] as const),
  );
  const emailByUser = new Map(
    emails.map((row) => [row.userId, decryptPii(row.emailEncrypted)] as const),
  );
  const docIdByUser = new Map(
    docs.map((row) => [row.userId, decryptPii(row.docAffiliationIdEncrypted)] as const),
  );
  const affiliationIds = [...new Set(docIdByUser.values())];
  const affiliations =
    affiliationIds.length === 0
      ? []
      : await tx.docAffiliation.findMany({
          where: { id: { in: affiliationIds } },
          select: { id: true, label: true },
        });
  const labelByAffiliation = new Map(affiliations.map((row) => [row.id, row.label] as const));
  const networkById = new Map(networks.map((row) => [row.id, row.name] as const));

  return listings.map((row) => {
    const title = titleByUser.get(row.userId);
    const email = emailByUser.get(row.userId);
    const affiliationId = docIdByUser.get(row.userId);
    const docLabel = affiliationId ? labelByAffiliation.get(affiliationId) : undefined;
    const listing: DecryptedListing = {
      id: row.userId,
      firstName: decryptPii(row.firstNameEncrypted),
      lastName: decryptPii(row.lastNameEncrypted),
      networkLabel: networkById.get(row.networkId) ?? "",
    };
    if (title !== undefined) {
      listing.title = title;
    }
    if (docLabel !== undefined) {
      listing.docLabel = docLabel;
    }
    if (email !== undefined) {
      listing.email = email;
    }
    return listing;
  });
}

export function toDirectoryMember(row: HydratedListing): DirectoryMember {
  return toMember(row);
}

export async function listDirectory(
  session: SessionClaims | null,
  input: DirectoryListInput = {},
): Promise<DirectoryListResult> {
  const claims = requireRole(session, {
    clientProgramRole: input.clientProgramRole,
    clientAdminRole: input.clientAdminRole,
  });
  const q = typeof input.q === "string" ? input.q.trim() : "";

  const loaded = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    async (tx) => {
      const allowed = await consumeDirectorySearch(tx, claims.userId);
      if (!allowed) {
        return { kind: "throttled" as const };
      }
      if (q.length > QUERY_MAX) {
        return { kind: "too_long" as const };
      }
      const listings = await tx.directoryListing.findMany({
        select: {
          userId: true,
          networkId: true,
          firstNameEncrypted: true,
          lastNameEncrypted: true,
        },
      });
      return {
        kind: "ok" as const,
        rows: await hydrateDirectoryListings(tx, listings),
      };
    },
  );

  switch (loaded.kind) {
    case "throttled":
      return { ok: false, error: DIRECTORY_SEARCH_TRY_LATER };
    case "too_long":
      return { ok: false, error: QUERY_TOO_LONG };
    case "ok": {
      const matched = loaded.rows.filter((row) => memberMatchesQuery(row, q));
      matched.sort((a, b) => {
        const last = a.lastName.localeCompare(b.lastName);
        if (last !== 0) {
          return last;
        }
        return a.firstName.localeCompare(b.firstName);
      });
      track("directory_search", {
        distinctId: claims.userId,
        programRole: claims.programRole,
        adminRole: claims.adminRole,
      });
      return { ok: true, members: matched.map(toMember) };
    }
    default: {
      const exhaustive: never = loaded;
      return exhaustive;
    }
  }
}
