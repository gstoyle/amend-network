import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { isForumStaff, rlsContext } from "@/lib/forum/staff";
import { FORUM_LISTING_REQUIRED_MESSAGE } from "@/lib/forum/validate";

export class ForumListingRequiredError extends Error {
  constructor() {
    super(FORUM_LISTING_REQUIRED_MESSAGE);
    this.name = "ForumListingRequiredError";
  }
}

export function memberHasForumAccess(input: {
  staff: boolean;
  directoryVisible: boolean;
}): boolean {
  return input.staff || input.directoryVisible;
}

export async function loadForumAccess(
  session: SessionClaims | null,
): Promise<{ claims: SessionClaims; allowed: boolean }> {
  const claims = requireRole(session);
  if (isForumStaff(claims)) {
    return { claims, allowed: true };
  }
  const user = await withRls(rlsContext(claims), async (tx) =>
    tx.user.findUnique({
      where: { id: claims.userId },
      select: { directoryVisible: true },
    }),
  );
  if (!user) {
    throw new AuthDeniedError();
  }
  return {
    claims,
    allowed: memberHasForumAccess({
      staff: false,
      directoryVisible: user.directoryVisible,
    }),
  };
}

export async function requireForumParticipant(
  session: SessionClaims | null,
): Promise<SessionClaims> {
  const { claims, allowed } = await loadForumAccess(session);
  if (!allowed) {
    throw new ForumListingRequiredError();
  }
  return claims;
}
