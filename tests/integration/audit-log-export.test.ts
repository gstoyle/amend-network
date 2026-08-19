import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { AuditLogExport } from "@/components/audit-log-export";
import { assertExportCsrf, exportAuditLog } from "@/lib/audit/export";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import { migrator } from "@/lib/db/migrator";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `vitest-audit-export-${randomUUID()}`;
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
const CSV_HEADERS = [
  "id",
  "created_at",
  "actor_user_id",
  "actor_role",
  "action",
  "entity_type",
  "entity_id",
  "target_user_id",
  "ip",
  "user_agent",
  "severity",
] as const;
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parseRfc4180(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const text = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        continue;
      }
      field += char;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field);
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }
    if (char === "\r") {
      continue;
    }
    field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
  }
  return rows;
}

async function countExported(): Promise<number> {
  return migrator.auditLog.count({
    where: { action: "audit_log_exported", userAgent: MARKER },
  });
}

describe("audit log CSV export (US5 / FR-015 / FR-016)", () => {
  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: { contains: MARKER } } });
  });

  it("Independent Test: Super Admin filters then exports; CSV matches; one export row with rowCount; RFC 4180; no decrypted PII", async () => {
    const actorA = randomUUID();
    const actorB = randomUUID();
    const target = randomUUID();
    const specialAgent = `=HYPERLINK("http://evil.example"), "quoted"\n${MARKER}`;
    const match = await migrator.auditLog.create({
      data: {
        actorUserId: actorA,
        actorRole: "admin",
        action: "login_success",
        entityType: "user",
        entityId: "id,with,comma",
        targetUserId: target,
        ip: "10.0.0.8",
        userAgent: specialAgent,
        severity: "warning",
        createdAt: new Date(Date.now() - TEN_DAYS_MS),
      },
    });
    await migrator.auditLog.create({
      data: {
        actorUserId: actorB,
        actorRole: "none",
        action: "login_success",
        ip: "10.0.0.9",
        userAgent: MARKER,
        severity: "security",
      },
    });
    await migrator.auditLog.create({
      data: {
        actorUserId: actorA,
        actorRole: "none",
        action: "logout",
        ip: "10.0.0.10",
        userAgent: MARKER,
        severity: "info",
      },
    });

    const before = await countExported();
    const first = await exportAuditLog(claimsFor("super_admin")!, {
      actor: actorA,
      action: "login_success",
      from: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      severity: "warning",
      ip: "127.0.0.1",
      userAgent: MARKER,
    });
    expect(await countExported()).toBe(before + 1);

    const table = parseRfc4180(first.csv);
    expect(table[0]).toEqual([...CSV_HEADERS]);
    expect(table).toHaveLength(2);
    const data = table[1]!;
    expect(data[0]).toBe(match.id.toString());
    expect(data[1]).toBe(match.createdAt.toISOString());
    expect(data[2]).toBe(actorA);
    expect(data[3]).toBe("admin");
    expect(data[4]).toBe("login_success");
    expect(data[5]).toBe("user");
    expect(data[6]).toBe("id,with,comma");
    expect(data[7]).toBe(target);
    expect(data[8]).toBe("10.0.0.8");
    expect(data[9]).toBe(`'${specialAgent}`);
    expect(data[10]).toBe("warning");
    expect(first.csv.toLowerCase()).not.toMatch(/doc_affiliation|first_name|last_name|"metadata"/);
    expect(first.csv).not.toMatch(/Jane|Doe|prisoner@example\.com/);

    const exportRow = await migrator.auditLog.findFirst({
      where: { action: "audit_log_exported", userAgent: MARKER },
      orderBy: { id: "desc" },
    });
    expect(exportRow).not.toBeNull();
    expect(exportRow?.metadata).toEqual({
      rowCount: 1,
      hasActor: true,
      hasAction: true,
      hasFrom: true,
      hasTo: false,
      hasSeverity: true,
    });
    expect(first.rowCount).toBe(1);

    const matchAfter = await migrator.auditLog.findUniqueOrThrow({ where: { id: match.id } });
    expect(matchAfter.action).toBe("login_success");
    expect(matchAfter.createdAt.toISOString()).toBe(match.createdAt.toISOString());

    await exportAuditLog(claimsFor("super_admin")!, {
      actor: actorA,
      action: "login_success",
      from: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      severity: "warning",
      ip: "127.0.0.1",
      userAgent: MARKER,
    });
    expect(await countExported()).toBe(before + 2);

    await expect(
      exportAuditLog(
        { ...claimsFor("admin")!, mfaSatisfied: true },
        { ip: "127.0.0.1", userAgent: MARKER, clientAdminRole: "super_admin" },
      ),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);
    expect(await countExported()).toBe(before + 2);
  });

  it("empty filter set is headers only and still writes audit_log_exported with rowCount 0", async () => {
    const before = await countExported();
    const result = await exportAuditLog(claimsFor("super_admin")!, {
      actor: randomUUID(),
      ip: "127.0.0.1",
      userAgent: MARKER,
    });
    const table = parseRfc4180(result.csv);
    expect(table).toEqual([[...CSV_HEADERS]]);
    expect(result.rowCount).toBe(0);
    expect(await countExported()).toBe(before + 1);
    const exportRow = await migrator.auditLog.findFirst({
      where: { action: "audit_log_exported", userAgent: MARKER },
      orderBy: { id: "desc" },
    });
    expect(exportRow?.metadata).toMatchObject({ rowCount: 0, hasActor: true });
  });

  it("does not write audit_log_viewed and omits metadata and decrypted PII columns", async () => {
    const actor = randomUUID();
    await migrator.auditLog.create({
      data: {
        actorUserId: actor,
        actorRole: "none",
        action: "logout",
        ip: "127.0.0.1",
        userAgent: MARKER,
        severity: "info",
        metadata: { note: "internal" },
      },
    });
    const result = await exportAuditLog(claimsFor("super_admin")!, {
      actor,
      action: "logout",
      ip: "127.0.0.1",
      userAgent: MARKER,
    });
    expect(result.csv.split(/\r?\n/)[0]).toBe(CSV_HEADERS.join(","));
    expect(result.csv).not.toContain("internal");
    expect(result.csv.toLowerCase()).not.toContain("metadata");
    expect(result.csv.toLowerCase()).not.toContain("doc_affiliation");
    const viewed = await migrator.auditLog.count({
      where: { action: "audit_log_viewed", userAgent: MARKER },
    });
    expect(viewed).toBe(0);
  });

  it("export control is presentational: shown only when canExport is true; no role branch", () => {
    const hidden = renderToStaticMarkup(
      createElement(AuditLogExport, { canExport: false, values: {} }),
    );
    expect(hidden).not.toMatch(/export/i);
    const shown = renderToStaticMarkup(
      createElement(AuditLogExport, { canExport: true, values: { action: "logout" } }),
    );
    expect(shown).toMatch(/export/i);
    expect(shown).toContain('action="/admin/audit-log/export"');
    expect(shown).toContain('method="post"');
    const source = readFileSync(path.join(repoRoot, "components/audit-log-export.tsx"), "utf8");
    expect(source).not.toMatch(/adminRole|super_admin|requireRole|mfaSatisfied/);
    const page = readFileSync(
      path.join(repoRoot, "app/(admin)/admin/audit-log/page.tsx"),
      "utf8",
    );
    expect(page).toContain("canExport");
    expect(page).toContain("AuditLogExport");
  });

  it("CSRF origin check refuses a cross-site POST before any export write", async () => {
    const before = await countExported();
    expect(() =>
      assertExportCsrf(
        new Request("http://127.0.0.1:3000/admin/audit-log/export", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() =>
      assertExportCsrf(
        new Request("http://127.0.0.1:3000/admin/audit-log/export", {
          method: "POST",
        }),
      ),
    ).toThrowError(AUTH_FAILURE_MESSAGE);
    expect(() =>
      assertExportCsrf(
        new Request("http://127.0.0.1:3000/admin/audit-log/export", {
          method: "POST",
          headers: { origin: "http://127.0.0.1:3000" },
        }),
      ),
    ).not.toThrow();
    expect(await countExported()).toBe(before);
  });
});
