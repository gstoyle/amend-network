import { writeAudit } from "@/lib/audit/write";
import { requireRole } from "@/lib/auth/requireRole";
import type { SessionClaims } from "@/lib/auth/types";
import { withRls } from "@/lib/db/rls";
import { visibilityTokens } from "@/lib/db/visibility";
import { presignGet } from "@/lib/storage/client";

const FILE_EXPIRES_SECONDS = 900;

export type DownloadGrantInput = {
  ip: string;
  userAgent: string;
  clientProgramRole?: unknown;
  clientAdminRole?: unknown;
};

function authorizeMember(
  session: SessionClaims | null,
  options: { clientProgramRole?: unknown; clientAdminRole?: unknown } = {},
): SessionClaims {
  return requireRole(session, {
    clientProgramRole: options.clientProgramRole,
    clientAdminRole: options.clientAdminRole,
  });
}

function actorRole(session: SessionClaims): string {
  return session.adminRole !== "none" ? session.adminRole : session.programRole;
}

async function loadLiveFile(
  claims: SessionClaims,
  id: string,
): Promise<{ id: string; fileObjectKey: string } | null> {
  const tokens = visibilityTokens(claims);
  if (tokens.length === 0) {
    return null;
  }
  const rows = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
    },
    (tx) =>
      tx.resource.findMany({
        where: {
          id,
          deletedAt: null,
          visibility: { hasSome: tokens },
        },
        select: {
          id: true,
          fileObjectKey: true,
        },
        take: 1,
      }),
  );
  return rows[0] ?? null;
}

export async function grantDownload(
  session: SessionClaims | null,
  id: string,
  input: DownloadGrantInput,
): Promise<string | null> {
  const claims = authorizeMember(session, input);
  const tokens = visibilityTokens(claims);
  if (tokens.length === 0) {
    return null;
  }

  const granted = await withRls(
    {
      userId: claims.userId,
      programRole: claims.programRole,
      adminRole: claims.adminRole,
      status: claims.status,
      authMode: "resource_download",
    },
    async (tx) => {
      const row = await tx.resource.findFirst({
        where: {
          id,
          deletedAt: null,
          visibility: { hasSome: tokens },
        },
        select: {
          id: true,
          fileObjectKey: true,
          fileMimeType: true,
          fileSizeBytes: true,
        },
      });
      if (!row) {
        return null;
      }
      await tx.$executeRaw`
        UPDATE resources SET download_count = download_count + 1 WHERE id = ${row.id}::uuid
      `;
      await writeAudit(tx, {
        actorUserId: claims.userId,
        actorRole: actorRole(claims),
        action: "resource_downloaded",
        entityType: "resource",
        entityId: row.id,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { mime: row.fileMimeType, bytes: Number(row.fileSizeBytes) },
        severity: "info",
      });
      return row.fileObjectKey;
    },
  );

  if (!granted) {
    return null;
  }
  return presignGet(granted, FILE_EXPIRES_SECONDS);
}

export async function grantFile(
  session: SessionClaims | null,
  id: string,
  options: { clientProgramRole?: unknown; clientAdminRole?: unknown } = {},
): Promise<string | null> {
  const claims = authorizeMember(session, options);
  const row = await loadLiveFile(claims, id);
  if (!row) {
    return null;
  }
  return presignGet(row.fileObjectKey, FILE_EXPIRES_SECONDS);
}
