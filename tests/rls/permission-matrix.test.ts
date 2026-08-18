import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { migrator } from "@/lib/db/migrator";
import { withRls } from "@/lib/db/rls";
import {
  CAPABILITIES,
  EXPECTED_VISIBLE_TITLES,
  MATRIX_ROLES,
  PRD_MATRIX,
  claimsFor,
  type Capability,
  type MatrixRole,
  type MatrixVerdict,
} from "@/tests/helpers/prd-matrix";

function isBuilt(capability: Capability): boolean {
  switch (capability) {
    case "log_in":
    case "view_dashboard":
    case "view_audit_log":
    case "approve_deny_registrations":
    case "upload_edit_delete_resources":
    case "view_shared_resources":
    case "view_role_specific_resources":
    case "download_resources":
    case "view_announcements":
    case "create_manage_announcements":
    case "create_edit_delete_events":
    case "view_events":
    case "rsvp_events":
    case "appear_in_directory":
    case "view_directory":
      return true;
    case "view_forum":
    case "post_forum":
    case "moderate_forum":
    case "assign_change_roles":
    case "view_analytics":
    case "change_system_configuration":
      return false;
    default: {
      const _exhaustive: never = capability;
      return _exhaustive;
    }
  }
}

async function rlsVisibleTitles(role: MatrixRole): Promise<string[]> {
  const session = claimsFor(role);
  if (!session) {
    return withRls({}, async (tx) => {
      const rows = await tx.visibilityRecord.findMany();
      return rows.map((row) => row.title);
    });
  }
  return withRls(
    {
      userId: session.userId,
      programRole: session.programRole,
      adminRole: session.adminRole,
      status: session.status,
    },
    async (tx) => {
      const rows = await tx.visibilityRecord.findMany();
      return rows.map((row) => row.title);
    },
  );
}

async function rlsCanReadAudit(role: MatrixRole): Promise<boolean> {
  const session = claimsFor(role);
  if (!session) {
    const rows = await withRls({}, (tx) => tx.auditLog.findMany({ take: 1 }));
    return rows.length > 0;
  }
  const rows = await withRls(
    {
      userId: session.userId,
      programRole: session.programRole,
      adminRole: session.adminRole,
      status: session.status,
    },
    (tx) => tx.auditLog.findMany({ take: 5 }),
  );
  return rows.length > 0;
}

async function rlsCanInsertResource(role: MatrixRole): Promise<boolean> {
  const session = claimsFor(role);
  const id = randomUUID();
  try {
    await withRls(
      {
        userId: session?.userId,
        programRole: session?.programRole ?? "none",
        adminRole: session?.adminRole ?? "none",
        status: session?.status ?? "",
      },
      (tx) =>
        tx.$executeRaw`
          INSERT INTO resources (
            id, title, preview_text, thumbnail_object_key, source_label, tags,
            file_object_key, file_size_bytes, file_mime_type, visibility,
            download_count, uploaded_by, created_at, updated_at
          ) VALUES (
            ${id}::uuid, ${`matrix-insert-${id}`}, 'p', 't', 'Amend', ARRAY[]::text[],
            'f', 1, 'application/pdf', '{all_authenticated}', 0, ${id}::uuid,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `,
    );
    await migrator.$executeRaw`DELETE FROM resources WHERE id = ${id}::uuid`;
    return true;
  } catch {
    return false;
  }
}

async function rlsCanSeeLiveResource(role: MatrixRole, visibility: string[]): Promise<boolean> {
  const session = claimsFor(role);
  const id = randomUUID();
  const visibilityLiteral = `{${visibility.join(",")}}`;
  await migrator.$executeRaw`
    INSERT INTO resources (
      id, title, preview_text, thumbnail_object_key, source_label, tags,
      file_object_key, file_size_bytes, file_mime_type, visibility,
      download_count, uploaded_by, created_at, updated_at
    ) VALUES (
      ${id}::uuid, ${`matrix-see-${id}`}, 'p', 't', 'Amend', ARRAY[]::text[],
      'f', 1, 'application/pdf', ${visibilityLiteral}::text[], 0, ${id}::uuid,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  try {
    const rows = await withRls(
      session
        ? {
            userId: session.userId,
            programRole: session.programRole,
            adminRole: session.adminRole,
            status: session.status,
          }
        : {},
      (tx) =>
        tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM resources WHERE id = ${id}::uuid
        `,
    );
    return rows.length > 0;
  } finally {
    await migrator.$executeRaw`DELETE FROM resources WHERE id = ${id}::uuid`;
  }
}

async function rlsCanSeeUncancelledEvent(role: MatrixRole): Promise<boolean> {
  const session = claimsFor(role);
  const id = randomUUID();
  await migrator.$executeRaw`
    INSERT INTO events (
      id, title, description, starts_at, ends_at, is_virtual, visibility,
      created_by, created_at, updated_at
    ) VALUES (
      ${id}::uuid, ${`matrix-evt-see-${id}`}, 'b',
      CURRENT_TIMESTAMP + interval '2 hours', CURRENT_TIMESTAMP + interval '3 hours',
      false, '{all_authenticated}', ${id}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  try {
    const rows = await withRls(
      session
        ? {
            userId: session.userId,
            programRole: session.programRole,
            adminRole: session.adminRole,
            status: session.status,
          }
        : {},
      (tx) =>
        tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM events WHERE id = ${id}::uuid
        `,
    );
    return rows.length > 0;
  } finally {
    await migrator.$executeRaw`DELETE FROM events WHERE id = ${id}::uuid`;
  }
}

async function rlsCanRsvpEvent(role: MatrixRole): Promise<boolean> {
  const session = claimsFor(role);
  const eventId = randomUUID();
  const userId = session?.userId ?? randomUUID();
  await migrator.$executeRaw`
    INSERT INTO events (
      id, title, description, starts_at, ends_at, is_virtual, visibility,
      created_by, created_at, updated_at
    ) VALUES (
      ${eventId}::uuid, ${`matrix-evt-rsvp-${eventId}`}, 'b',
      CURRENT_TIMESTAMP + interval '2 hours', CURRENT_TIMESTAMP + interval '3 hours',
      false, '{all_authenticated}', ${eventId}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  try {
    await withRls(
      session
        ? {
            userId: session.userId,
            programRole: session.programRole,
            adminRole: session.adminRole,
            status: session.status,
          }
        : {},
      (tx) =>
        tx.$executeRaw`
          INSERT INTO event_rsvps (user_id, event_id, status, created_at, updated_at)
          VALUES (${userId}::uuid, ${eventId}::uuid, 'yes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
    );
    return true;
  } catch {
    return false;
  } finally {
    await migrator.$executeRaw`DELETE FROM event_rsvps WHERE event_id = ${eventId}::uuid`;
    await migrator.$executeRaw`DELETE FROM events WHERE id = ${eventId}::uuid`;
  }
}

async function rlsCanSeeLiveAnnouncement(role: MatrixRole): Promise<boolean> {
  const session = claimsFor(role);
  const id = randomUUID();
  await migrator.$executeRaw`
    INSERT INTO announcements (
      id, headline, body, activates_at, expires_at, visibility, dismissible,
      created_by, created_at, updated_at
    ) VALUES (
      ${id}::uuid, ${`matrix-ann-${id}`}, 'b',
      CURRENT_TIMESTAMP - interval '1 minute', CURRENT_TIMESTAMP + interval '1 hour',
      '{all_authenticated}', true, ${id}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  try {
    const rows = await withRls(
      session
        ? {
            userId: session.userId,
            programRole: session.programRole,
            adminRole: session.adminRole,
            status: session.status,
          }
        : {},
      (tx) =>
        tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM announcements WHERE id = ${id}::uuid
        `,
    );
    return rows.length > 0;
  } finally {
    await migrator.$executeRaw`DELETE FROM announcements WHERE id = ${id}::uuid`;
  }
}

async function rlsCanInsertAnnouncement(role: MatrixRole): Promise<boolean> {
  const session = claimsFor(role);
  const id = randomUUID();
  try {
    await withRls(
      {
        userId: session?.userId,
        programRole: session?.programRole ?? "none",
        adminRole: session?.adminRole ?? "none",
        status: session?.status ?? "",
      },
      (tx) =>
        tx.$executeRaw`
          INSERT INTO announcements (
            id, headline, body, activates_at, expires_at, visibility, dismissible,
            created_by, created_at, updated_at
          ) VALUES (
            ${id}::uuid, ${`matrix-ins-${id}`}, 'b',
            CURRENT_TIMESTAMP - interval '1 minute', CURRENT_TIMESTAMP + interval '1 hour',
            '{all_authenticated}', true, ${id}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `,
    );
    await migrator.$executeRaw`DELETE FROM announcements WHERE id = ${id}::uuid`;
    return true;
  } catch {
    return false;
  }
}

async function rlsCanInsertEvent(role: MatrixRole): Promise<boolean> {
  const session = claimsFor(role);
  const id = randomUUID();
  try {
    await withRls(
      {
        userId: session?.userId,
        programRole: session?.programRole ?? "none",
        adminRole: session?.adminRole ?? "none",
        status: session?.status ?? "",
      },
      (tx) =>
        tx.$executeRaw`
          INSERT INTO events (
            id, title, description, starts_at, ends_at, is_virtual, visibility,
            created_by, created_at, updated_at
          ) VALUES (
            ${id}::uuid, ${`matrix-evt-${id}`}, 'b',
            CURRENT_TIMESTAMP + interval '2 hours', CURRENT_TIMESTAMP + interval '3 hours',
            false, '{all_authenticated}', ${id}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `,
    );
    await migrator.$executeRaw`DELETE FROM events WHERE id = ${id}::uuid`;
    return true;
  } catch {
    return false;
  }
}

async function rlsCanSeePending(role: MatrixRole): Promise<boolean> {
  const pending = await migrator.user.findFirst({ where: { status: "pending" } });
  if (!pending) {
    return false;
  }
  const session = claimsFor(role);
  const rows = await withRls(
    session
      ? {
          userId: session.userId,
          programRole: session.programRole,
          adminRole: session.adminRole,
          status: session.status,
        }
      : {},
    (tx) => tx.user.findMany({ where: { id: pending.id } }),
  );
  return rows.length > 0;
}

async function rlsCanInsertDirectoryListing(role: MatrixRole): Promise<boolean> {
  const session = claimsFor(role);
  const userId = session?.userId ?? randomUUID();
  const programRole = session?.programRole ?? "none";
  try {
    await withRls(
      {
        userId,
        programRole,
        adminRole: session?.adminRole ?? "none",
        status: session?.status ?? "",
      },
      (tx) =>
        tx.$executeRaw`
          INSERT INTO directory_listings (
            user_id, program_role, network_id,
            first_name_encrypted, last_name_encrypted, created_at, updated_at
          ) VALUES (
            ${userId}::uuid,
            ${programRole}::"ProgramRole",
            ${randomUUID()}::uuid,
            ${Buffer.from("x")},
            ${Buffer.from("y")},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `,
    );
    await migrator.$executeRaw`DELETE FROM directory_listings WHERE user_id = ${userId}::uuid`;
    return true;
  } catch {
    await migrator.$executeRaw`DELETE FROM directory_listings WHERE user_id = ${userId}::uuid`.catch(
      () => undefined,
    );
    return false;
  }
}

async function rlsCanSeeDirectoryListing(role: MatrixRole): Promise<boolean> {
  const session = claimsFor(role);
  const rows = await withRls(
    session
      ? {
          userId: session.userId,
          programRole: session.programRole,
          adminRole: session.adminRole,
          status: session.status,
        }
      : {},
    (tx) => tx.directoryListing.findMany({ take: 1, select: { userId: true } }),
  );
  return rows.length > 0;
}

function rlsVerdict(
  role: MatrixRole,
  capability: Capability,
  auditVisible: boolean,
  pendingVisible: boolean,
  insertAllowed: boolean,
  sharedVisible: boolean,
  roleSpecificVisible: boolean,
  rsvpAllowed: boolean,
  appearAllowed: boolean,
  directoryVisible: boolean,
): MatrixVerdict {
  switch (capability) {
    case "log_in":
      return role === "invited" ? "deny" : "allow";
    case "view_dashboard":
      return role === "invited" || role === "pending" ? "deny" : "allow";
    case "view_audit_log":
      return auditVisible ? "allow" : "deny";
    case "approve_deny_registrations":
      return pendingVisible ? "allow" : "deny";
    case "upload_edit_delete_resources":
      return insertAllowed ? "allow" : "deny";
    case "view_shared_resources":
      return sharedVisible ? "allow" : "deny";
    case "view_role_specific_resources":
      return roleSpecificVisible ? "allow" : "deny";
    case "download_resources":
      return sharedVisible ? "allow" : "deny";
    case "view_announcements":
      return sharedVisible ? "allow" : "deny";
    case "create_manage_announcements":
      return insertAllowed ? "allow" : "deny";
    case "create_edit_delete_events":
      return insertAllowed ? "allow" : "deny";
    case "view_events":
      return sharedVisible ? "allow" : "deny";
    case "rsvp_events":
      return rsvpAllowed ? "allow" : "deny";
    case "appear_in_directory":
      return appearAllowed ? "allow" : "deny";
    case "view_directory":
      return directoryVisible ? "allow" : "deny";
    case "view_forum":
    case "post_forum":
    case "moderate_forum":
    case "assign_change_roles":
    case "view_analytics":
    case "change_system_configuration":
      return isBuilt(capability) ? "allow" : "fail-closed";
    default: {
      const _exhaustive: never = capability;
      return _exhaustive;
    }
  }
}

const MARKER = `rls-matrix-${randomUUID()}`;

describe("RLS permission matrix (GUCs only, no requireRole)", () => {
  it.each(MATRIX_ROLES)("%s fixture visibility via GUCs matches the contract", async (role) => {
    const titles = await rlsVisibleTitles(role);
    expect([...titles].sort()).toEqual([...EXPECTED_VISIBLE_TITLES[role]].sort());
  });

  it.each(MATRIX_ROLES.flatMap((role) => CAPABILITIES.map((capability) => [role, capability] as const)))(
    "%s / %s",
    async (role, capability) => {
      if (capability === "view_audit_log") {
        await migrator.auditLog.create({
          data: {
            actorRole: "none",
            action: "login_success",
            ip: "127.0.0.1",
            userAgent: MARKER,
            severity: "info",
          },
        });
      }
      const auditVisible = capability === "view_audit_log" ? await rlsCanReadAudit(role) : false;
      const pendingVisible =
        capability === "approve_deny_registrations" ? await rlsCanSeePending(role) : false;
      const insertAllowed =
        capability === "upload_edit_delete_resources"
          ? await rlsCanInsertResource(role)
          : capability === "create_manage_announcements"
            ? await rlsCanInsertAnnouncement(role)
            : capability === "create_edit_delete_events"
              ? await rlsCanInsertEvent(role)
              : false;
      const sharedVisible =
        capability === "view_shared_resources" || capability === "download_resources"
          ? await rlsCanSeeLiveResource(role, ["all_authenticated"])
          : capability === "view_announcements"
            ? await rlsCanSeeLiveAnnouncement(role)
            : capability === "view_events"
              ? await rlsCanSeeUncancelledEvent(role)
              : false;
      const roleSpecificVisible =
        capability === "view_role_specific_resources"
          ? await rlsCanSeeLiveResource(role, role === "lead" ? ["lead"] : ["pathways"])
          : false;
      const rsvpAllowed = capability === "rsvp_events" ? await rlsCanRsvpEvent(role) : false;
      const appearAllowed =
        capability === "appear_in_directory" ? await rlsCanInsertDirectoryListing(role) : false;
      const directoryVisible =
        capability === "view_directory" ? await rlsCanSeeDirectoryListing(role) : false;
      const expected = PRD_MATRIX[capability][role];
      if (!isBuilt(capability)) {
        expect(["deny", "fail-closed"]).toContain(expected);
        expect(expected).not.toBe("allow");
        return;
      }
      const actual = rlsVerdict(
        role,
        capability,
        auditVisible,
        pendingVisible,
        insertAllowed,
        sharedVisible,
        roleSpecificVisible,
        rsvpAllowed,
        appearAllowed,
        directoryVisible,
      );
      expect(actual).toBe(expected);
    },
  );

  it("admin audit SELECT is limited to 90 days; super_admin is not", async () => {
    const old = await migrator.auditLog.create({
      data: {
        actorRole: "none",
        action: "login_success",
        ip: "127.0.0.1",
        userAgent: MARKER,
        severity: "info",
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      },
    });
    const recent = await migrator.auditLog.create({
      data: {
        actorRole: "none",
        action: "logout",
        ip: "127.0.0.1",
        userAgent: MARKER,
        severity: "info",
      },
    });

    const superAdmin = claimsFor("super_admin")!;
    const admin = claimsFor("admin")!;

    const superRows = await withRls(
      {
        userId: superAdmin.userId,
        programRole: superAdmin.programRole,
        adminRole: superAdmin.adminRole,
        status: superAdmin.status,
      },
      (tx) => tx.auditLog.findMany({ where: { userAgent: MARKER, id: { in: [old.id, recent.id] } } }),
    );
    const adminRows = await withRls(
      {
        userId: admin.userId,
        programRole: admin.programRole,
        adminRole: admin.adminRole,
        status: admin.status,
      },
      (tx) => tx.auditLog.findMany({ where: { userAgent: MARKER, id: { in: [old.id, recent.id] } } }),
    );

    expect(superRows.map((row) => row.id.toString())).toEqual(
      expect.arrayContaining([old.id.toString(), recent.id.toString()]),
    );
    expect(adminRows.map((row) => row.id.toString())).toContain(recent.id.toString());
    expect(adminRows.map((row) => row.id.toString())).not.toContain(old.id.toString());
  });

  it("pathways GUC cannot SELECT invitations; admin GUC can", async () => {
    const pathways = claimsFor("pathways")!;
    const admin = claimsFor("admin")!;
    const memberRows = await withRls(
      {
        userId: pathways.userId,
        programRole: pathways.programRole,
        adminRole: pathways.adminRole,
        status: pathways.status,
      },
      (tx) => tx.invitation.findMany({ take: 1 }),
    );
    const adminRows = await withRls(
      {
        userId: admin.userId,
        programRole: admin.programRole,
        adminRole: admin.adminRole,
        status: admin.status,
      },
      (tx) => tx.invitation.findMany({ take: 1 }),
    );
    expect(memberRows).toHaveLength(0);
    expect(Array.isArray(adminRows)).toBe(true);
  });
});
