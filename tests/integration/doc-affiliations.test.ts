import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURE_MESSAGE } from "@/lib/auth/errors";
import {
  addDocAffiliation,
  deactivateDocAffiliation,
  editDocAffiliation,
  listActiveDocAffiliations,
} from "@/lib/registration/doc-affiliations";
import { migrator } from "@/lib/db/migrator";
import { claimsFor } from "@/tests/helpers/prd-matrix";

const MARKER = `doc-aff-${randomUUID()}`;
const IP = "127.0.0.1";
const USER_AGENT = `vitest-${MARKER}`;

function adminSession() {
  return {
    ...claimsFor("admin")!,
    mfaEnabled: true,
    mfaSatisfied: true,
  };
}

async function addMarked(label: string) {
  return addDocAffiliation(adminSession(), {
    label: `${MARKER}-${label}`,
    ip: IP,
    userAgent: USER_AGENT,
  });
}

describe("DOC affiliation list (US1 / FR-013)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    await migrator.auditLog.deleteMany({ where: { userAgent: USER_AGENT } });
    if (createdIds.length > 0) {
      await migrator.docAffiliation.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  it("admin can add, edit the label, and deactivate; public list is active-only", async () => {
    const created = await addMarked("alpha");
    createdIds.push(created.id);
    expect(created.active).toBe(true);
    expect(created.label).toBe(`${MARKER}-alpha`);

    const renamed = await editDocAffiliation(adminSession(), {
      id: created.id,
      label: `${MARKER}-alpha-renamed`,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(renamed.label).toBe(`${MARKER}-alpha-renamed`);
    expect(renamed.id).toBe(created.id);

    const deactivated = await deactivateDocAffiliation(adminSession(), {
      id: created.id,
      ip: IP,
      userAgent: USER_AGENT,
    });
    expect(deactivated.active).toBe(false);
    expect(await migrator.docAffiliation.findUnique({ where: { id: created.id } })).not.toBeNull();

    const publicLabels = (await listActiveDocAffiliations()).map((row) => row.label);
    expect(publicLabels).not.toContain(`${MARKER}-alpha-renamed`);
    expect(publicLabels).toContain("Test Agency A");
    expect(publicLabels).toContain("Test Agency B");
    expect(publicLabels).not.toContain("Test Agency Inactive");
  });

  it("writes system_setting_changed in the same transaction as add/edit/deactivate", async () => {
    const created = await addMarked("audited");
    createdIds.push(created.id);
    await editDocAffiliation(adminSession(), {
      id: created.id,
      label: `${MARKER}-audited-edit`,
      ip: IP,
      userAgent: USER_AGENT,
    });
    await deactivateDocAffiliation(adminSession(), {
      id: created.id,
      ip: IP,
      userAgent: USER_AGENT,
    });

    const rows = await migrator.auditLog.findMany({
      where: { action: "system_setting_changed", userAgent: USER_AGENT },
      orderBy: { createdAt: "asc" },
    });
    expect(rows).toHaveLength(3);
    const ops = rows.map((row) => {
      const metadata = row.metadata as { setting?: string; op?: string };
      expect(metadata.setting).toBe("doc_affiliation");
      expect(metadata).not.toHaveProperty("doc_affiliation");
      return metadata.op;
    });
    expect(ops).toEqual(["add", "edit", "deactivate"]);
  });

  it("Independent Test: Admin adds two, deactivates one; /register shows only active; Moderator denied", async () => {
    const first = await addMarked("keep");
    const second = await addMarked("drop");
    createdIds.push(first.id, second.id);
    await deactivateDocAffiliation(adminSession(), {
      id: second.id,
      ip: IP,
      userAgent: USER_AGENT,
    });

    await expect(
      addDocAffiliation(claimsFor("moderator"), {
        label: `${MARKER}-moderator`,
        ip: IP,
        userAgent: USER_AGENT,
        clientAdminRole: "admin",
        clientMfaSatisfied: true,
      }),
    ).rejects.toThrowError(AUTH_FAILURE_MESSAGE);

    const active = await listActiveDocAffiliations();
    const labels = active.map((row) => row.label);
    expect(labels).toContain(`${MARKER}-keep`);
    expect(labels).not.toContain(`${MARKER}-drop`);
    expect(labels).not.toContain("Test Agency Inactive");

    const formSource = readFileSync(
      path.join(process.cwd(), "components/register-form.tsx"),
      "utf8",
    );
    expect(formSource).toContain("<Select");
    expect(formSource).toContain('name="docAffiliation"');
    expect(formSource).not.toMatch(/name=["']docAffiliation["'][^>]*type=["']text["']/i);
    expect(formSource).not.toMatch(/<Input[^>]*name=["']docAffiliation["']/i);

    const page = await import("@/app/(auth)/register/page");
    expect(typeof page.default).toBe("function");
    await page.default();
  });
});
