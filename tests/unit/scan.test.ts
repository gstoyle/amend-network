import { describe, expect, it } from "vitest";
import { EICAR, scanBytes } from "@/lib/scan/clamav";

describe("scan port (EICAR double)", () => {
  it("treats the EICAR test string as infected", async () => {
    expect(await scanBytes(Buffer.from(EICAR, "utf8"))).toBe("infected");
  });

  it("treats a clean PDF-like payload as clean", async () => {
    expect(await scanBytes(Buffer.from("%PDF-1.1 fixture", "utf8"))).toBe("clean");
  });
});
