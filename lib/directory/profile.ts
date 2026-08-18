import { z } from "zod";
import { track } from "@/lib/analytics/track";
import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import {
  hydrateDirectoryListings,
  toDirectoryMember,
  type DirectoryMember,
} from "@/lib/directory/list";

const subjectIdSchema = z.string().uuid();

export type DirectoryProfileContext = {
  ip: string;
  userAgent: string;
};

export type DirectoryProfileInput = {
  clientProgramRole?: unknown;
  clientAdminRole?: unknown;
};

function actorRole(session: SessionClaims): string {
  return session.adminRole !== "none" ? session.adminRole : session.programRole;
}

export async function getDirectoryProfile(
  session: SessionClaims | null,
  subjectId: string,
  ctx: DirectoryProfileContext,
  input: DirectoryProfileInput = {},
): Promise<DirectoryMember | null> {
  const claims = requireRole(session, {
    clientProgramRole: input.clientProgramRole,
    clientAdminRole: input.clientAdminRole,
  });
  const parsed = subjectIdSchema.safeParse(subjectId);
  if (!parsed.success) {
    return null;
  }

  const member = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    async (tx) => {
      const listing = await tx.directoryListing.findUnique({
        where: { userId: parsed.data },
        select: {
          userId: true,
          networkId: true,
          firstNameEncrypted: true,
          lastNameEncrypted: true,
        },
      });
      if (!listing) {
        return null;
      }
      const [hydrated] = await hydrateDirectoryListings(tx, [listing]);
      if (!hydrated) {
        return null;
      }
      if (claims.userId !== parsed.data) {
        await writeAudit(tx, {
          actorUserId: claims.userId,
          actorRole: actorRole(claims),
          action: "directory_profile_viewed",
          entityType: "directory_profile",
          entityId: parsed.data,
          targetUserId: parsed.data,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          metadata: {},
          severity: "info",
        });
      }
      return toDirectoryMember(hydrated);
    },
  );

  if (member && claims.userId !== parsed.data) {
    track("directory_profile_viewed", {
      distinctId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      viewedUserId: parsed.data,
    });
  }
  return member;
}
