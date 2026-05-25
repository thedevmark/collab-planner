import { describe, it, expect } from "vitest";
import { analyzePatterns, type StreamSession } from "./patterns";

describe("analyzePatterns with timezone", () => {
  // Build a fixture: 12 sessions, all starting at 23:00 UTC on Sun/Mon/Wed.
  // In UTC binning these are Sun/Mon/Wed at hour 23.
  // In America/New_York (UTC-5 in winter), 23:00 UTC = 18:00 ET, still
  // Sun/Mon/Wed at hour 18.
  // In Asia/Tokyo (UTC+9), 23:00 UTC = 08:00 next day JST, so the days
  // shift to Mon/Tue/Thu at hour 8.
  function makeSessions(): StreamSession[] {
    const sessions: StreamSession[] = [];
    const baseSunday = new Date("2026-01-04T23:00:00Z"); // Sunday 23 UTC
    for (let i = 0; i < 4; i++) {
      const weekOffset = i * 7 * 86_400_000;
      for (const dowOffset of [0, 1, 3]) { // Sun, Mon, Wed
        const start = new Date(baseSunday.getTime() + weekOffset + dowOffset * 86_400_000);
        const end = new Date(start.getTime() + 4 * 3600_000);
        sessions.push({
          startTime: start,
          endTime: end,
          gameName: "Apex Legends",
          durationSec: 4 * 3600,
        });
      }
    }
    return sessions;
  }

  it("bins days in America/New_York", () => {
    const p = analyzePatterns(1, "Test", makeSessions(), [], "America/New_York");
    expect(p.typicalDays.slice(0, 3).sort()).toEqual(["Monday", "Sunday", "Wednesday"]);
    expect(p.startHours.median).toBe(18);
  });

  it("bins days in UTC (legacy default)", () => {
    const p = analyzePatterns(1, "Test", makeSessions(), [], "UTC");
    expect(p.typicalDays.slice(0, 3).sort()).toEqual(["Monday", "Sunday", "Wednesday"]);
    expect(p.startHours.median).toBe(23);
  });

  it("shifts days when binning in Asia/Tokyo", () => {
    const p = analyzePatterns(1, "Test", makeSessions(), [], "Asia/Tokyo");
    expect(p.typicalDays.slice(0, 3).sort()).toEqual(["Monday", "Thursday", "Tuesday"]);
    expect(p.startHours.median).toBe(8);
  });

  it("falls back to UTC when timezone arg is omitted", () => {
    const p = analyzePatterns(1, "Test", makeSessions(), []);
    expect(p.startHours.median).toBe(23);
  });
});
