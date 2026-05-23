import type { StreamingPattern } from "@/lib/scheduling/patterns";

/**
 * Shape of the payload the panel SPA renders. Designed to mirror the visual
 * model used by Collab Planner's in-app friend cards: one summary line plus
 * a 7-day chip row, with collabs surfaced separately when present.
 */
export type PanelResponse =
  | {
      status: "ok";
      summary: {
        /** Days the streamer typically goes live, e.g. ["Sun", "Tue", "Mon"]. */
        topDays: string[];
        /** Median start hour in UTC (0-23). SPA renders it in the viewer's local timezone. */
        medianHourUtc: number;
        /** Top game by frequency, or null if unknown. */
        topGame: string | null;
        /** True when sample size is too small for confident prediction. */
        isEstimate: boolean;
        /** True when one or more posted Twitch schedule slots exist within the next 14 days. */
        hasPostedSchedule: boolean;
      };
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

/** Convert StreamingPattern's full day names (e.g. "Sunday") to short ones (e.g. "Sun"). */
function shortenDays(longDays: string[]): string[] {
  const SHORT_BY_LONG: Record<string, string> = {
    Sunday: "Sun",
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
  };
  return longDays.map((d) => SHORT_BY_LONG[d] ?? d).filter(Boolean);
}

export function shapeConnectedPanelResponse(inputs: Inputs): PanelResponse {
  const { pattern, postedSchedule, upcomingCollabs } = inputs;

  if (pattern.sampleSize === 0 && postedSchedule.length === 0) {
    return { status: "no_data" };
  }

  const topDays = shortenDays(pattern.typicalDays).slice(0, 3);
  const medianHourUtc = pattern.startHours.median;
  const topGame = pattern.topGames[0] ?? null;
  const isEstimate = pattern.confidence === "estimated" || pattern.sampleSize < 3;
  const hasPostedSchedule = postedSchedule.length > 0;

  return {
    status: "ok",
    summary: { topDays, medianHourUtc, topGame, isEstimate, hasPostedSchedule },
    collabs: upcomingCollabs,
    generatedAt: new Date().toISOString(),
  };
}
