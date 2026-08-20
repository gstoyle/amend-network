import { describe, expect, it } from "vitest";
import { resourceFormatLabel, resourceSizeLabel } from "@/lib/resources/list";

/**
 * 012 T005 — FR-008, FR-009.
 * Both derivations live in lib/ so the card stays presentational and so the
 * byte formatting is testable without rendering anything.
 */
describe("resourceFormatLabel (012 T005)", () => {
  it("maps each known stored type to its design label", () => {
    expect(resourceFormatLabel("application/pdf")).toBe("PDF");
    expect(resourceFormatLabel("video/mp4")).toBe("Video");
    expect(
      resourceFormatLabel(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    ).toBe("Slides");
    expect(resourceFormatLabel("application/vnd.ms-powerpoint")).toBe("Slides");
    expect(
      resourceFormatLabel(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("Template");
    expect(resourceFormatLabel("application/msword")).toBe("Template");
    expect(resourceFormatLabel("text/markdown")).toBe("Template");
    expect(resourceFormatLabel("application/zip")).toBe("Toolkit");
  });

  it("returns null rather than a placeholder for an unrecognised type", () => {
    expect(resourceFormatLabel("application/octet-stream")).toBeNull();
    expect(resourceFormatLabel("")).toBeNull();
  });

  it("ignores parameters and casing on the stored type", () => {
    expect(resourceFormatLabel("application/pdf; charset=binary")).toBe("PDF");
    expect(resourceFormatLabel("APPLICATION/PDF")).toBe("PDF");
  });
});

describe("resourceSizeLabel (012 T005)", () => {
  it("omits the size when there is nothing usable to show", () => {
    expect(resourceSizeLabel(0n)).toBeNull();
    expect(resourceSizeLabel(-1n)).toBeNull();
    expect(resourceSizeLabel(null)).toBeNull();
  });

  it("reads bytes below one kilobyte", () => {
    expect(resourceSizeLabel(1n)).toBe("1 byte");
    expect(resourceSizeLabel(512n)).toBe("512 bytes");
    expect(resourceSizeLabel(1023n)).toBe("1023 bytes");
  });

  it("reads whole kilobytes up to one megabyte", () => {
    expect(resourceSizeLabel(1024n)).toBe("1 KB");
    expect(resourceSizeLabel(389_120n)).toBe("380 KB");
    expect(resourceSizeLabel(1_048_575n)).toBe("1024 KB");
  });

  it("reads megabytes to one decimal, trimming a trailing zero", () => {
    expect(resourceSizeLabel(1_048_576n)).toBe("1 MB");
    expect(resourceSizeLabel(4_404_019n)).toBe("4.2 MB");
    expect(resourceSizeLabel(4_194_304n)).toBe("4 MB");
  });

  it("reads gigabytes to one decimal", () => {
    expect(resourceSizeLabel(1_073_741_824n)).toBe("1 GB");
    expect(resourceSizeLabel(1_395_864_371n)).toBe("1.3 GB");
  });

  it("accepts a plain number as well as a bigint", () => {
    expect(resourceSizeLabel(389_120)).toBe("380 KB");
  });
});
