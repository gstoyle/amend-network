import { requireRole } from "@/lib/auth/requireRole";
import type { ProgramRole, SessionClaims } from "@/lib/auth/types";
import { decryptPii } from "@/lib/crypto/pii";
import { withRls } from "@/lib/db/rls";
import { PROGRAM_LABELS } from "@/lib/db/visibility";

export type ShellIdentity = {
  displayName: string;
  initials: string;
  programRoleLabel: string;
  /** Null whenever the display name fell back, so a greeting can choose
   * neutral wording rather than splitting a placeholder. */
  firstName: string | null;
};

const FALLBACK_NAME = "Member";
const FALLBACK_INITIALS = "—";

const PROGRAM_ROLE_LABELS: Record<ProgramRole, string> = {
  ...PROGRAM_LABELS,
  none: "Staff",
};

function initialsFrom(firstName: string, lastName: string): string {
  const letters = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
  return letters.length > 0 ? letters : FALLBACK_INITIALS;
}

/**
 * Name and program role only. FR-018 keeps email, title, and DOC affiliation
 * out of persistent chrome, so those columns are never selected.
 */
export async function loadShellIdentity(
  session: SessionClaims | null,
): Promise<ShellIdentity> {
  const claims = requireRole(session, { statuses: ["active", "pending"] });
  const programRoleLabel = PROGRAM_ROLE_LABELS[claims.programRole];

  return withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: claims.userId },
        select: { firstNameEncrypted: true, lastNameEncrypted: true },
      });

      const firstName = user?.firstNameEncrypted
        ? decryptPii(user.firstNameEncrypted)
        : "";
      const lastName = user?.lastNameEncrypted ? decryptPii(user.lastNameEncrypted) : "";
      const displayName = `${firstName} ${lastName}`.trim();

      // A retention-anonymized account has empty name columns; never render a blank block.
      if (displayName.length === 0) {
        return {
          displayName: FALLBACK_NAME,
          initials: FALLBACK_INITIALS,
          programRoleLabel,
          firstName: null,
        };
      }

      return {
        displayName,
        initials: initialsFrom(firstName, lastName),
        programRoleLabel,
        firstName: firstName.trim() || null,
      };
    },
  );
}
