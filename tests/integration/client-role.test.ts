import { describe, expect, it } from "vitest";
import { requireRole } from "@/lib/auth/requireRole";
import { listVisibleRecords } from "@/lib/db/visibility";
import { claimsFor } from "@/tests/helpers/prd-matrix";

describe("client-supplied roles are ignored (FR-007)", () => {
  it("requireRole still denies a missing session when the client claims pathways", () => {
    expect(() =>
      requireRole(null, {
        clientProgramRole: "pathways",
        clientAdminRole: "super_admin",
      }),
    ).toThrowError();
  });

  it("a Pathways session does not see LEAD-only rows when the client claims lead", async () => {
    const session = claimsFor("pathways");
    const claims = requireRole(session, { clientProgramRole: "lead" });
    expect(claims.programRole).toBe("pathways");
    const rows = await listVisibleRecords(claims);
    expect(rows.map((row) => row.title)).not.toContain("LEAD only");
    expect(rows.map((row) => row.title)).toContain("Pathways only");
  });

  it("a LEAD session does not see Pathways-only rows when the client claims pathways", async () => {
    const session = claimsFor("lead");
    const claims = requireRole(session, { clientProgramRole: "pathways" });
    expect(claims.programRole).toBe("lead");
    const rows = await listVisibleRecords(claims);
    expect(rows.map((row) => row.title)).not.toContain("Pathways only");
    expect(rows.map((row) => row.title)).toContain("LEAD only");
  });
});
