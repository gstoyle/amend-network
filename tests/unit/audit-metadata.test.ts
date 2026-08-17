import { describe, expect, it } from "vitest";
import { writeAudit } from "@/lib/audit/write";
import { withRls } from "@/lib/db/rls";

const BASE = {
  actorRole: "anonymous",
  action: "login_failure" as const,
  ip: "127.0.0.1",
  userAgent: "vitest-audit-metadata",
  severity: "warning" as const,
};

describe("audit metadata PII denylist (FR-018)", () => {
  it.each([
    "email",
    "name",
    "first_name",
    "last_name",
    "password",
    "token",
    "secret",
    "mfa",
    "doc",
    "doc_affiliation",
  ])(
    "rejects metadata key %s",
    async (key) => {
      await expect(
        withRls({}, (tx) =>
          writeAudit(tx, {
            ...BASE,
            metadata: { [key]: "redacted-should-never-store" },
          }),
        ),
      ).rejects.toThrowError("audit metadata must not contain PII fields");
    },
  );

  it("accepts non-PII metadata", async () => {
    await expect(
      withRls({}, (tx) =>
        writeAudit(tx, {
          ...BASE,
          metadata: { unknown: true, reason: "generic" },
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it("accepts non-PII join-slice metadata keys", async () => {
    await expect(
      withRls({}, (tx) =>
        writeAudit(tx, {
          ...BASE,
          metadata: { count: 2, program_role: "pathways", setting: "doc_affiliation", op: "add", has_reason: true },
        }),
      ),
    ).resolves.toBeUndefined();
  });
});
