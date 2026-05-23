import { describe, it, expect } from "vitest";
import { formatSlot } from "./format";

describe("formatSlot", () => {
  it("formats a UTC start time in the given timezone as 'Day h:mm a'", () => {
    // 2026-05-26T20:00:00Z is Tuesday 4:00pm America/New_York (EDT, UTC-4)
    const result = formatSlot("2026-05-26T20:00:00.000Z", {
      locale: "en-US",
      timeZone: "America/New_York",
    });
    expect(result.day).toBe("Tue");
    expect(result.time).toBe("4:00 PM");
  });

  it("respects the locale string for day labels", () => {
    const result = formatSlot("2026-05-26T20:00:00.000Z", {
      locale: "de-DE",
      timeZone: "Europe/Berlin",
    });
    // In de-DE, narrow weekday Tuesday is "Di"
    expect(result.day).toBe("Di");
  });

  it("handles a UTC timezone", () => {
    const result = formatSlot("2026-05-26T20:00:00.000Z", {
      locale: "en-US",
      timeZone: "UTC",
    });
    expect(result.day).toBe("Tue");
    expect(result.time).toBe("8:00 PM");
  });
});
