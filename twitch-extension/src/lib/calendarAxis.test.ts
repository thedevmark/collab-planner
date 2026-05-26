import { describe, it, expect } from "vitest";
import { computeAxisRange } from "./calendarAxis";

describe("computeAxisRange", () => {
  it("pads 2h before earliest start and 1h after latest end", () => {
    // Sun 3pm-7pm + Mon 7pm-11pm + Wed 7pm-11pm
    const r = computeAxisRange([
      { dow: 0, startHour: 15, durationHours: 4, confidence: "high" },
      { dow: 1, startHour: 19, durationHours: 4, confidence: "high" },
      { dow: 3, startHour: 19, durationHours: 4, confidence: "high" },
    ]);
    expect(r).toEqual({ startHour: 13, endHour: 24 });
  });

  it("expands to 10-hour minimum window when actual span is too tight", () => {
    // Single Wed 8pm-11pm — actual span 3h, padded would be only 6h.
    const r = computeAxisRange([
      { dow: 3, startHour: 20, durationHours: 3, confidence: "high" },
    ]);
    expect(r.endHour - r.startHour).toBeGreaterThanOrEqual(10);
    expect(r.startHour).toBeLessThanOrEqual(18);
    expect(r.endHour).toBeGreaterThanOrEqual(23);
  });

  it("extends past 24 when latest end wraps past midnight", () => {
    // Mon 11pm-3am — endHour 23+4 = 27
    const r = computeAxisRange([
      { dow: 1, startHour: 23, durationHours: 4, confidence: "high" },
    ]);
    expect(r.startHour).toBe(21);
    expect(r.endHour).toBeGreaterThanOrEqual(28); // 27 + 1h pad
  });

  it("ignores low-confidence entries when computing the window", () => {
    // High: Mon 7pm-11pm. Low: Fri 11am-2pm (would otherwise extend the window).
    const r = computeAxisRange([
      { dow: 1, startHour: 19, durationHours: 4, confidence: "high" },
      { dow: 5, startHour: 11, durationHours: 3, confidence: "low" },
    ]);
    expect(r.startHour).toBeGreaterThanOrEqual(14);
    expect(r.endHour).toBeLessThanOrEqual(24);
  });

  it("falls back to a default 12pm-12am window when perDay is empty", () => {
    expect(computeAxisRange([])).toEqual({ startHour: 12, endHour: 24 });
  });
});
