import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit/write";
import { AuthDeniedError, requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { decryptPii } from "@/lib/crypto/pii";
import { withRls } from "@/lib/db/rls";

const privacySchema = z.object({
  listing: z.boolean(),
  showTitle: z.boolean(),
  showDocAffiliation: z.boolean(),
  showEmail: z.boolean(),
});

export type PrivacyFlags = z.infer<typeof privacySchema>;

export type PrivacyInput = PrivacyFlags & {
  clientProgramRole?: unknown;
  clientAdminRole?: unknown;
};

export type PrivacyWriteContext = {
  ip: string;
  userAgent: string;
};

export type PrivacySaveResult = { ok: true; listed: boolean } | { ok: false; error: string };

export type DirectoryPrivacyView = PrivacyFlags & {
  title: string;
  docLabel: string;
  email: string;
  privacySetAt: Date | null;
  canAppear: boolean;
};

function canAppear(programRole: string, status: string): boolean {
  return status === "active" && (programRole === "pathways" || programRole === "lead");
}

function actorRole(session: SessionClaims): string {
  return session.adminRole !== "none" ? session.adminRole : session.programRole;
}

async function upsertListing(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    programRole: "pathways" | "lead";
    networkId: string;
    firstNameEncrypted: Uint8Array;
    lastNameEncrypted: Uint8Array;
  },
): Promise<void> {
  const firstName = Buffer.from(input.firstNameEncrypted);
  const lastName = Buffer.from(input.lastNameEncrypted);
  const updated = await tx.$executeRaw`
    UPDATE directory_listings SET
      network_id = ${input.networkId}::uuid,
      first_name_encrypted = ${firstName},
      last_name_encrypted = ${lastName},
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${input.userId}::uuid
  `;
  if (Number(updated) > 0) {
    return;
  }
  switch (input.programRole) {
    case "pathways":
      await tx.$executeRaw`
        INSERT INTO directory_listings (
          user_id, program_role, network_id,
          first_name_encrypted, last_name_encrypted, created_at, updated_at
        ) VALUES (
          ${input.userId}::uuid,
          'pathways'::"ProgramRole",
          ${input.networkId}::uuid,
          ${firstName},
          ${lastName},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
      return;
    case "lead":
      await tx.$executeRaw`
        INSERT INTO directory_listings (
          user_id, program_role, network_id,
          first_name_encrypted, last_name_encrypted, created_at, updated_at
        ) VALUES (
          ${input.userId}::uuid,
          'lead'::"ProgramRole",
          ${input.networkId}::uuid,
          ${firstName},
          ${lastName},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
      return;
    default: {
      const _exhaustive: never = input.programRole;
      return _exhaustive;
    }
  }
}

async function syncShownField(
  tx: Prisma.TransactionClient,
  userId: string,
  table: "directoryShownTitle" | "directoryShownDoc" | "directoryShownEmail",
  shouldShow: boolean,
  ciphertext: Uint8Array | null,
): Promise<void> {
  const bytes = ciphertext ? Buffer.from(ciphertext) : null;
  switch (table) {
    case "directoryShownTitle":
      await tx.$executeRaw`DELETE FROM directory_shown_titles WHERE user_id = ${userId}::uuid`;
      if (shouldShow && bytes) {
        await tx.$executeRaw`
          INSERT INTO directory_shown_titles (user_id, title_encrypted, updated_at)
          VALUES (${userId}::uuid, ${bytes}, CURRENT_TIMESTAMP)
        `;
      }
      return;
    case "directoryShownDoc":
      await tx.$executeRaw`DELETE FROM directory_shown_docs WHERE user_id = ${userId}::uuid`;
      if (shouldShow && bytes) {
        await tx.$executeRaw`
          INSERT INTO directory_shown_docs (user_id, doc_affiliation_id_encrypted, updated_at)
          VALUES (${userId}::uuid, ${bytes}, CURRENT_TIMESTAMP)
        `;
      }
      return;
    case "directoryShownEmail":
      await tx.$executeRaw`DELETE FROM directory_shown_emails WHERE user_id = ${userId}::uuid`;
      if (shouldShow && bytes) {
        await tx.$executeRaw`
          INSERT INTO directory_shown_emails (user_id, email_encrypted, updated_at)
          VALUES (${userId}::uuid, ${bytes}, CURRENT_TIMESTAMP)
        `;
      }
      return;
    default: {
      const _exhaustive: never = table;
      return _exhaustive;
    }
  }
}

async function deleteListingProjection(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$executeRaw`DELETE FROM directory_shown_titles WHERE user_id = ${userId}::uuid`;
  await tx.$executeRaw`DELETE FROM directory_shown_docs WHERE user_id = ${userId}::uuid`;
  await tx.$executeRaw`DELETE FROM directory_shown_emails WHERE user_id = ${userId}::uuid`;
  await tx.$executeRaw`DELETE FROM directory_listings WHERE user_id = ${userId}::uuid`;
}

export async function saveDirectoryPrivacy(
  session: SessionClaims | null,
  input: PrivacyInput,
  ctx: PrivacyWriteContext,
): Promise<PrivacySaveResult> {
  const claims = requireRole(session, {
    clientProgramRole: input.clientProgramRole,
    clientAdminRole: input.clientAdminRole,
  });
  const parsed = privacySchema.safeParse({
    listing: input.listing,
    showTitle: input.showTitle,
    showDocAffiliation: input.showDocAffiliation,
    showEmail: input.showEmail,
  });
  if (!parsed.success) {
    return { ok: false, error: "Check your directory privacy choices and try again." };
  }

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
        select: {
          id: true,
          programRole: true,
          status: true,
          networkId: true,
          firstNameEncrypted: true,
          lastNameEncrypted: true,
          titleEncrypted: true,
          docAffiliationIdEncrypted: true,
          emailEncrypted: true,
          directoryVisible: true,
          directoryShowTitle: true,
          directoryShowDocAffiliation: true,
          directoryShowEmail: true,
        },
      });
      if (!user) {
        throw new AuthDeniedError();
      }

      const listed =
        canAppear(user.programRole, user.status) && parsed.data.listing;
      const firstName = user.firstNameEncrypted;
      const lastName = user.lastNameEncrypted;
      const networkId = user.networkId;
      if (listed && (!networkId || !firstName || !lastName)) {
        return {
          ok: false,
          error: "Your profile needs a name and network before you can appear in the directory.",
        };
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          directoryVisible: listed,
          directoryShowTitle: parsed.data.showTitle,
          directoryShowDocAffiliation: parsed.data.showDocAffiliation,
          directoryShowEmail: parsed.data.showEmail,
          directoryPrivacySetAt: new Date(),
        },
      });

      if (
        listed &&
        networkId &&
        firstName &&
        lastName &&
        (user.programRole === "pathways" || user.programRole === "lead")
      ) {
        await upsertListing(tx, {
          userId: user.id,
          programRole: user.programRole,
          networkId,
          firstNameEncrypted: firstName,
          lastNameEncrypted: lastName,
        });
        await syncShownField(
          tx,
          user.id,
          "directoryShownTitle",
          parsed.data.showTitle,
          user.titleEncrypted,
        );
        await syncShownField(
          tx,
          user.id,
          "directoryShownDoc",
          parsed.data.showDocAffiliation,
          user.docAffiliationIdEncrypted,
        );
        await syncShownField(
          tx,
          user.id,
          "directoryShownEmail",
          parsed.data.showEmail,
          user.emailEncrypted,
        );
      } else {
        await deleteListingProjection(tx, user.id);
      }

      const metadata: Record<string, boolean> = {};
      if (user.directoryVisible !== listed) {
        metadata.listing = listed;
      }
      if (user.directoryShowTitle !== parsed.data.showTitle) {
        metadata.showTitle = parsed.data.showTitle;
      }
      if (user.directoryShowDocAffiliation !== parsed.data.showDocAffiliation) {
        metadata.showDocAffiliation = parsed.data.showDocAffiliation;
      }
      if (user.directoryShowEmail !== parsed.data.showEmail) {
        metadata.showEmail = parsed.data.showEmail;
      }

      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: actorRole(claims),
        action: "directory_privacy_changed",
        entityType: "user",
        entityId: claims.userId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata,
        severity: "info",
      });

      return { ok: true, listed };
    },
  );
}

export async function loadDirectoryPrivacy(
  session: SessionClaims | null,
): Promise<DirectoryPrivacyView> {
  const claims = requireRole(session);
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
        select: {
          programRole: true,
          status: true,
          titleEncrypted: true,
          docAffiliationIdEncrypted: true,
          emailEncrypted: true,
          directoryVisible: true,
          directoryShowTitle: true,
          directoryShowDocAffiliation: true,
          directoryShowEmail: true,
          directoryPrivacySetAt: true,
        },
      });
      if (!user) {
        throw new AuthDeniedError();
      }

      let docLabel = "";
      if (user.docAffiliationIdEncrypted) {
        const affiliationId = decryptPii(user.docAffiliationIdEncrypted);
        const affiliation = await tx.docAffiliation.findUnique({
          where: { id: affiliationId },
          select: { label: true },
        });
        docLabel = affiliation?.label ?? "";
      }

      return {
        listing: user.directoryVisible,
        showTitle: user.directoryShowTitle,
        showDocAffiliation: user.directoryShowDocAffiliation,
        showEmail: user.directoryShowEmail,
        title: user.titleEncrypted ? decryptPii(user.titleEncrypted) : "",
        docLabel,
        email: decryptPii(user.emailEncrypted),
        privacySetAt: user.directoryPrivacySetAt,
        canAppear: canAppear(user.programRole, user.status),
      };
    },
  );
}
