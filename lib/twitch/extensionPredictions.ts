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
        /** Per-day-of-week stream pattern. See StreamingPattern.perDay. */
        perDay: Array<{
          dow: number;
          startHour: number;
          durationHours: number;
          confidence: "high" | "low";
        }>;
        /** Number of historical VOD sessions used to compute this pattern. */
        sampleSize: number;
        /** Half-hour rounded minute of the median start time (0 or 30).
         *  Surfaced only in the "around 7:30 PM" support text. */
        medianMinute: 0 | 30;
        /** Broadcaster's Twitch profile image URL, or null if unknown. */
        broadcasterAvatar: string | null;
        /** Broadcaster's display name, or null if unknown. */
        broadcasterName: string | null;
      };
      lastStream: { startedAt: string; gameName: string | null; durationSec: number } | null;
      /** Set when the broadcaster is live right now. Panel UI takes over the hero with a LIVE state. */
      liveNow: { startedAt: string; gameName: string | null; title: string | null } | null;
      generatedAt: string;
    }
  | { status: "warming" }
  | { status: "no_data" };

interface PostedSlot {
  start: Date;
  end: Date;
}

interface Inputs {
  pattern: StreamingPattern;
  postedSchedule: PostedSlot[];
  timezone?: string;
  lastStream: { startedAt: Date; gameName: string | null; durationSec: number } | null;
  broadcasterAvatar?: string | null;
  broadcasterName?: string | null;
  liveNow?: { startedAt: Date; gameName: string | null; title: string | null } | null;
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
  const { pattern, postedSchedule, timezone = "UTC", lastStream, broadcasterAvatar = null, broadcasterName = null, liveNow = null } = inputs;

  if (pattern.sampleSize === 0 && postedSchedule.length === 0) {
    return { status: "no_data" };
  }

  const topDays = shortenDays(pattern.typicalDays).slice(0, 3);
  const medianHour = pattern.startHours.median;
  const isEstimate = pattern.confidence === "estimated" || pattern.sampleSize < 3;
  const hasPostedSchedule = postedSchedule.length > 0;

  return {
    status: "ok",
    summary: {
      topDays,
      medianHour,
      tz: timezone,
      isEstimate,
      hasPostedSchedule,
      hourDistribution: pattern.hourDistribution,
      dayFrequency: pattern.dayFrequency,
      avgDurationHours: pattern.avgDurationHours,
      // Single source of truth for "typical start time": every per-day
      // entry's startHour is forced to medianHour before the panel sees
      // it, so the calendar pill positions can never drift from the
      // "around X PM" text in ScheduleSummary. Per-day medians were
      // computed independently before, which let e.g. Saturday's pill
      // sit at 9pm while the hero text said "around 8pm". The panel
      // bundle is already published, so the only place we can guarantee
      // consistency is here, in the response shaper.
      perDay: pattern.perDay.map((d) => ({ ...d, startHour: medianHour })),
      sampleSize: pattern.sampleSize,
      medianMinute: pattern.medianMinute,
      broadcasterAvatar,
      broadcasterName,
    },
    lastStream: lastStream
      ? {
          startedAt: lastStream.startedAt.toISOString(),
          gameName: lastStream.gameName,
          durationSec: lastStream.durationSec,
        }
      : null,
    liveNow: liveNow
      ? {
          startedAt: liveNow.startedAt.toISOString(),
          gameName: liveNow.gameName,
          title: liveNow.title,
        }
      : null,
    generatedAt: new Date().toISOString(),
  };
}
