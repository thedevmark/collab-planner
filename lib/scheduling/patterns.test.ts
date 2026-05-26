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

describe("analyzePatterns perDay", () => {
  function makeMixedSchedule(): StreamSession[] {
    // 4 weeks of: Sun 3pm-7pm + Mon 7pm-11pm + Wed 7pm-11pm. UTC binning.
    // Plus a single one-off Friday 9pm stream (low confidence — only 1 session).
    const sessions: StreamSession[] = [];
    const sun = new Date("2026-01-04T15:00:00Z"); // Sun 3pm UTC, hour=15
    for (let w = 0; w < 4; w++) {
      const weekMs = w * 7 * 86_400_000;
      // Sun 3pm
      sessions.push({
        startTime: new Date(sun.getTime() + weekMs),
        endTime: new Date(sun.getTime() + weekMs + 4 * 3600_000),
        gameName: "Apex Legends",
        durationSec: 4 * 3600,
      });
      // Mon 7pm (Sun + 1 day + 4h)
      const mon = new Date(sun.getTime() + weekMs + 86_400_000 + 4 * 3600_000);
      sessions.push({
        startTime: mon,
        endTime: new Date(mon.getTime() + 4 * 3600_000),
        gameName: "Apex Legends",
        durationSec: 4 * 3600,
      });
      // Wed 7pm (Sun + 3 days + 4h)
      const wed = new Date(sun.getTime() + weekMs + 3 * 86_400_000 + 4 * 3600_000);
      sessions.push({
        startTime: wed,
        endTime: new Date(wed.getTime() + 4 * 3600_000),
        gameName: "Apex Legends",
        durationSec: 4 * 3600,
      });
    }
    // One-off Friday 9pm in the first week only
    const fri = new Date(sun.getTime() + 5 * 86_400_000 + 6 * 3600_000); // Fri 21:00
    sessions.push({
      startTime: fri,
      endTime: new Date(fri.getTime() + 3 * 3600_000),
      gameName: "Just Chatting",
      durationSec: 3 * 3600,
    });
    return sessions;
  }

  it("returns high-confidence entries for days with N >= 3 streams", () => {
    const p = analyzePatterns(1, "Test", makeMixedSchedule(), [], "UTC");
    const sun = p.perDay.find((d) => d.dow === 0);
    const mon = p.perDay.find((d) => d.dow === 1);
    const wed = p.perDay.find((d) => d.dow === 3);
    expect(sun).toEqual({ dow: 0, startHour: 15, durationHours: 4, confidence: "high" });
    expect(mon).toEqual({ dow: 1, startHour: 19, durationHours: 4, confidence: "high" });
    expect(wed).toEqual({ dow: 3, startHour: 19, durationHours: 4, confidence: "high" });
  });

  it("filters perDay to typicalDays so non-pattern days don't render", () => {
    // Fri has 1 stream — not in topDays (Sun/Mon/Wed are top 3), so excluded.
    const p = analyzePatterns(1, "Test", makeMixedSchedule(), [], "UTC");
    expect(p.perDay.find((d) => d.dow === 5)).toBeUndefined(); // Fri excluded
    // Sun, Mon, Wed are all present (they're in typicalDays)
    expect(p.perDay.map((d) => d.dow).sort()).toEqual([0, 1, 3]);
  });

  it("omits days that are not in typicalDays", () => {
    const p = analyzePatterns(1, "Test", makeMixedSchedule(), [], "UTC");
    expect(p.perDay.find((d) => d.dow === 2)).toBeUndefined(); // Tue
    expect(p.perDay.find((d) => d.dow === 4)).toBeUndefined(); // Thu
    expect(p.perDay.find((d) => d.dow === 5)).toBeUndefined(); // Fri (one-off)
    expect(p.perDay.find((d) => d.dow === 6)).toBeUndefined(); // Sat
  });

  it("uses the timezone for binning", () => {
    // Same fixture, but Tokyo (UTC+9) shifts 15:00 UTC Sun → 00:00 Mon JST
    const p = analyzePatterns(1, "Test", makeMixedSchedule(), [], "Asia/Tokyo");
    const monEntry = p.perDay.find((d) => d.dow === 1 && d.startHour === 0);
    expect(monEntry?.confidence).toBe("high");
  });
});
