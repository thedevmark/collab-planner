import type { StreamingPattern } from "@/lib/scheduling/patterns";

export type PanelResponse =
  | {
      status: "ok";
      predictions: Array<{
        day: string;
        startsAt: string;
        durationHours: number;
        confidence: 1 | 2 | 3;
        isPosted: boolean;
      }>;
      collabs: Array<{
        startsAt: string;
        gameName: string | null;
        partners: Array<{ username: string; displayName: string; avatarUrl: string }>;
      }>;
      generatedAt: string;
    }
  | { status: "warming" }
  | { status: "no_data" };

interface PostedSlot {
  start: Date;
  end: Date;
}

interface CollabInput {
  startsAt: string;
  gameName: string | null;
  partners: Array<{ username: string; displayName: string; avatarUrl: string }>;
}

interface Inputs {
  pattern: StreamingPattern;
  postedSchedule: PostedSlot[];
  upcomingCollabs: CollabInput[];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const POSTED_MATCH_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function confidenceTier(c: StreamingPattern["confidence"]): 1 | 2 | 3 {
  if (c === "estimated") return 1;
  if (c === "weak" || c === "moderate") return 2;
  return 3; // strong, schedule
}

export function shapeConnectedPanelResponse(inputs: Inputs): PanelResponse {
  const { pattern, postedSchedule, upcomingCollabs } = inputs;

  if (pattern.sampleSize === 0 && postedSchedule.length === 0) {
    return { status: "no_data" };
  }

  const confidence = confidenceTier(pattern.confidence);
  const durationHours = pattern.avgDurationHours;

  const predictions = pattern.inferredWindows
    .slice()
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 5)
    .map((w) => {
      const isPosted = postedSchedule.some(
        (p) => Math.abs(p.start.getTime() - w.start.getTime()) <= POSTED_MATCH_WINDOW_MS
      );
      return {
        day: DAY_NAMES[w.start.getUTCDay()],
        startsAt: w.start.toISOString(),
        durationHours,
        confidence,
        isPosted,
      };
    });

  return {
    status: "ok",
    predictions,
    collabs: upcomingCollabs,
    generatedAt: new Date().toISOString(),
  };
}
