import { describe, expect, it } from "vitest";
import { registrationVisitorCopy } from "@/lib/registration/register";

describe("registration visitor copy (US2 / FR-003 / FR-004)", () => {
  it("is identical for new and existing accounts", () => {
    expect(registrationVisitorCopy("created")).toBe(registrationVisitorCopy("duplicate"));
    expect(registrationVisitorCopy("created")).toBe(
      "If this email is eligible, you will receive instructions.",
    );
  });
});
