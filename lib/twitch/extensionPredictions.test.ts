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
    });

    expect(resp.status).toBe("ok");
    if (resp.status !== "ok") return;
    expect(resp.summary.topDays).toEqual(["Tue", "Thu", "Sat"]);
    expect(resp.summary.medianHourUtc).toBe(20);
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
    });
    expect(resp.status).toBe("no_data");
  });

  it("returns null topGame when topGames is empty", () => {
    const noGames: StreamingPattern = { ...basePattern, topGames: [] };
    const resp = shapeConnectedPanelResponse({
      pattern: noGames,
      postedSchedule: [],
      upcomingCollabs: [],
    });
    if (resp.status !== "ok") throw new Error("expected ok");
    expect(resp.summary.topGame).toBeNull();
  });
});
