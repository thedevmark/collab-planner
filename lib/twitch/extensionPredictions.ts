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
        /** Typical start hour in the timezone "tz" below (0-23). */
        medianHour: number;
        /** IANA timezone used for binning. */
        tz: string;
        /** Top game by frequency, or null if unknown. (Kept for back-compat; new code uses topGames[].) */
        topGame: string | null;
        /** Top up-to-5 games by frequency, most-played first. Empty array if unknown. */
        topGames: string[];
        /** True when sample size is too small for confident prediction. */
        isEstimate: boolean;
        /** True when one or more posted Twitch schedule slots exist within the next 14 days. */
        hasPostedSchedule: boolean;
        /** Normalized stream frequency per hour-of-day (length 24, values 0-1). */
        hourDistribution: number[];
        /** Normalized stream frequency per day-of-week (length 7, values 0-1, index 0 = Sunday). */
        dayFrequency: number[];
        /** Typical session length in hours (used to size calendar event blocks). */
        avgDurationHours: number;
        /** Broadcaster's Twitch profile image URL, or null if unknown. */
        broadcasterAvatar: string | null;
        /** Broadcaster's display name, or null if unknown. */
        broadcasterName: string | null;
      };
      collabs: Array<{
        startsAt: string;
        gameName: string | null;
        partners: Array<{ username: string; displayName: string; avatarUrl: string }>;
      }>;
      lastStream: { startedAt: string; gameName: string | null; durationSec: number } | null;
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
  timezone?: string;
  lastStream: { startedAt: Date; gameName: string | null; durationSec: number } | null;
  broadcasterAvatar?: string | null;
  broadcasterName?: string | null;
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
  const { pattern, postedSchedule, upcomingCollabs, timezone = "UTC", lastStream, broadcasterAvatar = null, broadcasterName = null } = inputs;

  if (pattern.sampleSize === 0 && postedSchedule.length === 0) {
    return { status: "no_data" };
  }

  const topDays = shortenDays(pattern.typicalDays).slice(0, 3);
  const medianHour = pattern.startHours.median;
  const topGame = pattern.topGames[0] ?? null;
  const topGames = pattern.topGames.slice(0, 5);
  const isEstimate = pattern.confidence === "estimated" || pattern.sampleSize < 3;
  const hasPostedSchedule = postedSchedule.length > 0;

  return {
    status: "ok",
    summary: {
      topDays,
      medianHour,
      tz: timezone,
      topGame,
      topGames,
      isEstimate,
      hasPostedSchedule,
      hourDistribution: pattern.hourDistribution,
      dayFrequency: pattern.dayFrequency,
      avgDurationHours: pattern.avgDurationHours,
      broadcasterAvatar,
      broadcasterName,
    },
    collabs: upcomingCollabs,
    lastStream: lastStream
      ? {
          startedAt: lastStream.startedAt.toISOString(),
          gameName: lastStream.gameName,
          durationSec: lastStream.durationSec,
        }
      : null,
    generatedAt: new Date().toISOString(),
  };
}
