import { describe, it, expect } from "vitest";
import { shapeConnectedPanelResponse } from "./extensionPredictions";
import type { StreamingPattern } from "@/lib/scheduling/patterns";

const basePattern: StreamingPattern = {
  friendId: 1,
  displayName: "Streamer",
  typicalDays: ["Tuesday", "Thursday", "Saturday"],
  startHours: { earliest: 19, latest: 22, median: 20 },
  avgDurationHours: 3,
  topGames: ["Apex Legends", "Helldivers 2"],
  confidence: "strong",
  summary: "",
  inferredWindows: [],
  dayFrequency: [0, 0, 1, 0, 1, 0, 1],
  hourDistribution: new Array(24).fill(0.3),
  consistency: 1,
  sampleSize: 25,
};

describe("shapeConnectedPanelResponse", () => {
  it("returns summary with shortened top days and median hour", () => {
    const resp = shapeConnectedPanelResponse({
      pattern: basePattern,
      postedSchedule: [],
      upcomingCollabs: [],
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
      upcomingCollabs: [],
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
      upcomingCollabs: [],
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
      upcomingCollabs: [],
      timezone: "UTC",
      lastStream: null,
    });
    if (resp.status !== "ok") throw new Error("expected ok");
    expect(resp.summary.isEstimate).toBe(true);
  });

  it("includes collabs in the response", () => {
    const resp = shapeConnectedPanelResponse({
      pattern: basePattern,
      postedSchedule: [],
      upcomingCollabs: [
        {
          startsAt: "2026-05-30T20:00:00.000Z",
          gameName: "Apex Legends",
          partners: [{ username: "alice", displayName: "Alice", avatarUrl: "" }],
        },
      ],
      timezone: "UTC",
      lastStream: null,
    });
    if (resp.status !== "ok") throw new Error("expected ok");
    expect(resp.collabs).toHaveLength(1);
    expect(resp.collabs[0].partners[0].username).toBe("alice");
  });

  it("returns no_data when sampleSize is 0 and no posted schedule", () => {
    const empty: StreamingPattern = { ...basePattern, sampleSize: 0, inferredWindows: [] };
    const resp = shapeConnectedPanelResponse({
      pattern: empty,
      postedSchedule: [],
      upcomingCollabs: [],
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
      upcomingCollabs: [],
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
      upcomingCollabs: [],
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
      upcomingCollabs: [],
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

  it("passes perDay through to the summary", () => {
    const result = shapeConnectedPanelResponse({
      pattern: pattern([
        { dow: 0, startHour: 15, durationHours: 4, confidence: "high" },
        { dow: 1, startHour: 19, durationHours: 4, confidence: "high" },
        { dow: 3, startHour: 19, durationHours: 4, confidence: "high" },
      ]),
      postedSchedule: [],
      upcomingCollabs: [],
      timezone: "America/New_York",
      lastStream: null,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.summary.perDay).toEqual([
        { dow: 0, startHour: 15, durationHours: 4, confidence: "high" },
        { dow: 1, startHour: 19, durationHours: 4, confidence: "high" },
        { dow: 3, startHour: 19, durationHours: 4, confidence: "high" },
      ]);
    }
  });
});
