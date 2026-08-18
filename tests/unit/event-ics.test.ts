import { describe, expect, it } from "vitest";
import { buildEventIcs } from "@/lib/events/ics";

describe("in-process ICS builder (US5)", () => {
  const startsAt = new Date("2026-08-18T18:00:00.000Z");
  const endsAt = new Date("2026-08-18T19:30:00.000Z");

  it("emits RFC 5545 subset with UTC times, escaped text, and no join URL by default", () => {
    const body = buildEventIcs({
      id: "00000000-0000-4000-8000-0000000000aa",
      title: "Meet; greet, and more\\notes",
      startsAt,
      endsAt,
      location: "Room 12, Building A",
    });
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("DTSTART:20260818T180000Z");
    expect(body).toContain("DTEND:20260818T193000Z");
    expect(body).toContain("SUMMARY:Meet\\; greet\\, and more\\\\notes");
    expect(body).toContain("LOCATION:Room 12\\, Building A");
    expect(body).toContain("END:VEVENT");
    expect(body).toContain("END:VCALENDAR");
    expect(body).not.toMatch(/https?:\/\//);
  });

  it("includes a join URL only when the caller supplies one", () => {
    const without = buildEventIcs({
      id: "00000000-0000-4000-8000-0000000000bb",
      title: "Online",
      startsAt,
      endsAt,
      location: null,
      joinUrl: null,
    });
    expect(without).not.toContain("https://zoom.example.test/j/secret");

    const withUrl = buildEventIcs({
      id: "00000000-0000-4000-8000-0000000000bb",
      title: "Online",
      startsAt,
      endsAt,
      location: null,
      joinUrl: "https://zoom.example.test/j/secret",
    });
    expect(withUrl).toContain("https://zoom.example.test/j/secret");
  });
});
