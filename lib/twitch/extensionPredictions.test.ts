import { describe, it, expect } from "vitest";
import { shapeConnectedPanelResponse } from "./extensionPredictions";
import type { StreamingPattern } from "@/lib/scheduling/patterns";

const basePattern: StreamingPattern = {
  friendId: 1,
  displayName: "Streamer",
  typicalDays: ["Tuesday", "Thursday", "Saturday"],
  startHours: { earliest: 19, latest: 22, median: 20 },
  medianMinute: 0,
  avgDurationHours: 3,
  topGames: ["Apex Legends", "Helldivers 2"],
  confidence: "strong",
  summary: "",
  inferredWindows: [],
  dayFrequency: [0, 0, 1, 0, 1, 0, 1],
  hourDistribution: new Array(24).fill(0.3),
  consistency: 1,
  sampleSize: 25,
  perDay: [],
};

describe("shapeConnectedPanelResponse", () => {
  it("returns summary with shortened top days and median hour", () => {
    const resp = shapeConnectedPanelResponse({
      pattern: basePattern,
      postedSchedule: [],
      // upcomingCollabs removed
      timezone: "UTC",
      lastStream: null,
    });

    expect(resp.status).toBe("ok");
    if (resp.status !== "ok") return;
    expect(resp.summary.topDays).toEqual(["Tue", "Thu", "Sat"]);
    expect(resp.summary.medianHour).toBe(20);
    expect(resp.summary.topGame).toBe("Apex Legends");
    expect(resp.summary.isEstimate).toBe(false);
    expect(resp.summary.hasPostedSchedule).toBe(false);
  });

  it("marks hasPostedSchedule when posted slots are present", () => {
    const resp = shapeConnectedPanelResponse({
      pattern: basePattern,
      postedSchedule: [
        { start: new Date("2026-05-26T20:00:00Z"), end: new Date("2026-05-26T23:00:00Z") },
      ],
      // upcomingCollabs removed
      timezone: "UTC",
      lastStream: null,
    });
    if (resp.status !== "ok") throw new Error("expected ok");
    expect(resp.summary.hasPostedSchedule).toBe(true);
  });

  it("flags isEstimate when sample size is small", () => {
    const small: StreamingPattern = { ...basePattern, sampleSize: 2, confidence: "weak" };
    const resp = shapeConnectedPanelResponse({
      pattern: small,
      postedSchedule: [],
      // upcomingCollabs removed
      timezone: "UTC",
      lastStream: null,
    });
    if (resp.status !== "ok") throw new Error("expected ok");
    expect(resp.summary.isEstimate).toBe(true);
  });

  it("flags isEstimate when confidence is 'estimated'", () => {
    const est: StreamingPattern = { ...basePattern, confidence: "estimated" };
    const resp = shapeConnectedPanelResponse({
      pattern: est,
      postedSchedule: [],
      // upcomingCollabs removed
      timezone: "UTC",
      lastStream: null,
    });
    if (resp.status !== "ok") throw new Error("expected ok");
    expect(resp.summary.isEstimate).toBe(true);
  });

  it("returns no_data when sampleSize is 0 and no posted schedule", () => {
    const empty: StreamingPattern = { ...basePattern, sampleSize: 0, inferredWindows: [] };
    const resp = shapeConnectedPanelResponse({
      pattern: empty,
      postedSchedule: [],
      // upcomingCollabs removed
      timezone: "UTC",
      lastStream: null,
    });
    expect(resp.status).toBe("no_data");
  });

  it("returns null topGame when topGames is empty", () => {
    const noGames: StreamingPattern = { ...basePattern, topGames: [] };
    const resp = shapeConnectedPanelResponse({
      pattern: noGames,
      postedSchedule: [],
      // upcomingCollabs removed
      timezone: "UTC",
      lastStream: null,
    });
    if (resp.status !== "ok") throw new Error("expected ok");
    expect(resp.summary.topGame).toBeNull();
  });

  it("includes timezone in the summary", () => {
    const resp = shapeConnectedPanelResponse({
      pattern: basePattern,
      postedSchedule: [],
      // upcomingCollabs removed
      timezone: "America/New_York",
      lastStream: null,
    });
    if (resp.status !== "ok") throw new Error("expected ok");
    expect(resp.summary.tz).toBe("America/New_York");
  });

  it("includes hourDistribution, dayFrequency, and lastStream in the response", () => {
    const resp = shapeConnectedPanelResponse({
      pattern: basePattern,
      postedSchedule: [],
      // upcomingCollabs removed
      timezone: "UTC",
      lastStream: {
        startedAt: new Date("2026-05-20T22:00:00Z"),
        gameName: "Apex Legends",
        durationSec: 14400,
      },
    });
    if (resp.status !== "ok") throw new Error("expected ok");
    expect(resp.summary.hourDistribution).toHaveLength(24);
    expect(resp.summary.dayFrequency).toHaveLength(7);
    expect(resp.lastStream).toEqual({
      startedAt: "2026-05-20T22:00:00.000Z",
      gameName: "Apex Legends",
      durationSec: 14400,
    });
  });
});

describe("shapeConnectedPanelResponse perDay", () => {
  function pattern(perDay: StreamingPattern["perDay"]): StreamingPattern {
    return {
      friendId: 1,
      displayName: "Test",
      typicalDays: ["Sunday", "Monday", "Wednesday"],
      startHours: { earliest: 15, latest: 19, median: 19 },
      medianMinute: 0,
      avgDurationHours: 4,
      topGames: ["Apex Legends"],
      confidence: "strong",
      summary: "summary",
      inferredWindows: [],
      dayFrequency: [1, 1, 0, 1, 0, 0, 0],
      hourDistribution: new Array(24).fill(0),
      consistency: 1,
      sampleSize: 12,
      perDay,
    };
  }

  it("forces every perDay.startHour to medianHour (single source of truth)", () => {
    // Input has a Sunday session at 15 (different from medianHour=19).
    // The shaper must override Sunday's startHour to 19 so the calendar
    // pill can never drift from the "around X PM" text in the panel.
    const result = shapeConnectedPanelResponse({
      pattern: pattern([
        { dow: 0, startHour: 15, durationHours: 4, confidence: "high" },
        { dow: 1, startHour: 19, durationHours: 4, confidence: "high" },
        { dow: 3, startHour: 19, durationHours: 4, confidence: "high" },
      ]),
      postedSchedule: [],
      timezone: "America/New_York",
      lastStream: null,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.summary.perDay).toEqual([
        { dow: 0, startHour: 19, durationHours: 4, confidence: "high" },
        { dow: 1, startHour: 19, durationHours: 4, confidence: "high" },
        { dow: 3, startHour: 19, durationHours: 4, confidence: "high" },
      ]);
      // All pills sit at medianHour, no drift possible.
      for (const d of result.summary.perDay) {
        expect(d.startHour).toBe(result.summary.medianHour);
      }
    }
  });
});
