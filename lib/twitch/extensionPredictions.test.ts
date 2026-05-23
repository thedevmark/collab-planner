import { describe, it, expect } from "vitest";
import { shapeConnectedPanelResponse } from "./extensionPredictions";
import type { StreamingPattern } from "@/lib/scheduling/patterns";

const basePattern: StreamingPattern = {
  friendId: 1,
  displayName: "Streamer",
  typicalDays: ["Tuesday", "Thursday", "Saturday"],
  startHours: { earliest: 19, latest: 22, median: 20 },
  avgDurationHours: 3,
  topGames: ["Apex Legends"],
  confidence: "strong",
  summary: "",
  inferredWindows: [
    { start: new Date("2026-05-26T20:00:00Z"), end: new Date("2026-05-26T23:00:00Z") },
    { start: new Date("2026-05-28T20:00:00Z"), end: new Date("2026-05-28T23:00:00Z") },
    { start: new Date("2026-05-30T20:00:00Z"), end: new Date("2026-05-30T23:00:00Z") },
  ],
  dayFrequency: [0, 0, 1, 0, 1, 0, 1],
  hourDistribution: new Array(24).fill(0.3),
  consistency: 1,
  sampleSize: 25,
};

describe("shapeConnectedPanelResponse", () => {
  it("returns predictions sorted by start time with confidence stars", () => {
    const resp = shapeConnectedPanelResponse({
      pattern: basePattern,
      postedSchedule: [],
      upcomingCollabs: [],
    });

    expect(resp.status).toBe("ok");
    if (resp.status !== "ok") return;
    expect(resp.predictions).toHaveLength(3);
    expect(resp.predictions[0].startsAt).toBe("2026-05-26T20:00:00.000Z");
    expect(resp.predictions[0].confidence).toBe(3); // "strong" → 3
    expect(resp.predictions[0].isPosted).toBe(false);
  });

  it("marks slots as isPosted=true when posted schedule matches within 1h", () => {
    const resp = shapeConnectedPanelResponse({
      pattern: basePattern,
      postedSchedule: [
        { start: new Date("2026-05-26T20:30:00Z"), end: new Date("2026-05-26T23:30:00Z") },
      ],
      upcomingCollabs: [],
    });

    expect(resp.status).toBe("ok");
    if (resp.status !== "ok") return;
    expect(resp.predictions[0].isPosted).toBe(true);
    expect(resp.predictions[1].isPosted).toBe(false);
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

    expect(resp.status).toBe("ok");
    if (resp.status !== "ok") return;
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

  it("maps confidence tiers correctly: estimated→1, weak/moderate→2, strong/schedule→3", () => {
    for (const [tier, expected] of [
      ["estimated", 1],
      ["weak", 2],
      ["moderate", 2],
      ["strong", 3],
      ["schedule", 3],
    ] as const) {
      const p = { ...basePattern, confidence: tier };
      const resp = shapeConnectedPanelResponse({
        pattern: p,
        postedSchedule: [],
        upcomingCollabs: [],
      });
      if (resp.status !== "ok") throw new Error("expected ok");
      expect(resp.predictions[0].confidence).toBe(expected);
    }
  });
});
