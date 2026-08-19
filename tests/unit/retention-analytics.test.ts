import { describe, expect, it } from "vitest";
import { createInMemoryAnalyticsRetentionPort } from "@/lib/analytics/retention";

const NOW = new Date("2026-08-18T12:00:00.000Z");

function utcMonthsPlusDaysBefore(now: Date, months: number, extraDays: number): Date {
  const value = new Date(now.getTime());
  value.setUTCMonth(value.getUTCMonth() - months);
  value.setUTCDate(value.getUTCDate() - extraDays);
  return value;
}

describe("in-memory AnalyticsRetentionPort (US4 / FR-006)", () => {
  it("removes events older than 24 months, keeps younger, and returns the deleted count", async () => {
    const oldEvent = { id: "old", occurredAt: utcMonthsPlusDaysBefore(NOW, 24, 1) };
    const youngEvent = { id: "young", occurredAt: utcMonthsPlusDaysBefore(NOW, 12, 0) };
    const port = createInMemoryAnalyticsRetentionPort([oldEvent, youngEvent]);
    const cutoff = utcMonthsPlusDaysBefore(NOW, 24, 0);

    const deleted = await port.deleteOlderThan(cutoff);

    expect(deleted).toBe(1);
    expect(port.snapshot().map((event) => event.id)).toEqual(["young"]);
  });
});
