import { describe, expect, it } from "vitest";
import { parseInviteCsv } from "@/lib/registration/csv";

const HEADER = "email,first_name,last_name,network_name,title,doc_affiliation";

function csv(rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("invite CSV parse (US4 / FR-006)", () => {
  it("accepts exact headers and quoted commas", () => {
    const result = parseInviteCsv(
      csv(['ada@example.com,"Lovelace, Ada",Lovelace,Pathways to Change,Analyst,Test Agency A']),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.firstName).toBe("Lovelace, Ada");
    expect(result.invalid).toHaveLength(0);
  });

  it("rejects a wrong header", () => {
    const result = parseInviteCsv("email,first,last,network,title,doc\nada@example.com,A,B,Pathways to Change,T,Test Agency A\n");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("bad_header");
    }
  });

  it("rejects more than 500 data rows", () => {
    const rows = Array.from({ length: 501 }, (_, i) =>
      `user${i}@example.com,First,Last,Pathways to Change,Title,Test Agency A`,
    );
    const result = parseInviteCsv(csv(rows));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("oversize");
    }
  });

  it("marks missing fields, malformed email, and later duplicate emails invalid", () => {
    const result = parseInviteCsv(
      csv([
        "ada@example.com,Ada,Lovelace,Pathways to Change,Analyst,Test Agency A",
        "not-an-email,Ada,Lovelace,Pathways to Change,Analyst,Test Agency A",
        "ada@example.com,Ada,Duplicate,Pathways to Change,Analyst,Test Agency A",
        ",Missing,Email,Pathways to Change,Analyst,Test Agency A",
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.valid.map((row) => row.email)).toEqual(["ada@example.com"]);
    expect(result.invalid.map((row) => row.reason).sort()).toEqual(
      ["duplicate_email_in_file", "malformed_email", "missing_required_field"].sort(),
    );
  });
});
