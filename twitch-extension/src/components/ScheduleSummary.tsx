import { type ReactNode } from "react";
import type { PanelResponse } from "../lib/types";
import { formatHour } from "../lib/format";
import { useMinuteTick } from "../lib/useMinuteTick";
import { pickNextStream, TODAY_GRACE_HOURS } from "../lib/nextStream";

type Summary = Extract<PanelResponse, { status: "ok" }>["summary"];

interface Props {
  summary: Summary;
  use24Hour?: boolean;
  /** When the broadcaster is currently live, skip today as a next-stream
   *  candidate so the panel points at the stream after this one. */
  skipToday?: boolean;
}

const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Resolve the next likely live moment to a concrete Date (broadcaster tz).
 *  Wraps pickNextStream and pins the chosen day to medianHour. */
export function nextLikelyLiveDate(
  topDays: string[],
  medianHour: number,
  tz: string,
  nowMs: number,
  skipToday = false,
): Date | null {
  const pick = pickNextStream(topDays, medianHour, tz, nowMs, skipToday);
  if (!pick) return null;
  const candidate = new Date(nowMs);
  candidate.setDate(candidate.getDate() + pick.daysAhead);
  candidate.setHours(medianHour, 0, 0, 0);
  return candidate;
}

/** "47 minutes" · "2h 38m" · "1 day 1 hour" · "any minute". */
export function formatCountdown(target: Date | null, nowMs: number): string {
  if (!target) return "";
  const diffMs = target.getTime() - nowMs;
  if (diffMs <= 0) return "any minute";
  const totalMin = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const mins = totalMin % 60;
  const word = (n: number, singular: string) => `${n} ${n === 1 ? singular : `${singular}s`}`;
  if (days > 0) return hours > 0 ? `${word(days, "day")} ${word(hours, "hour")}` : word(days, "day");
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return word(mins, "minute");
}

type HeroTone = "accent" | "dim";

interface Variant {
  eyebrow: ReactNode;
  hero: string;
  heroTone?: HeroTone;
  support: ReactNode;
}

function buildVariant(args: {
  medianHour: number;
  medianMinute: 0 | 30;
  avgDurationHours: number;
  nextFullDay: string | null;
  nextDaysAhead: number | null;
  countdown: string;
  hoursUntilNext: number | null;
  broadcasterName: string | null;
  use24Hour: boolean;
  skipToday: boolean;
}): Variant {
  const { medianHour, medianMinute, nextFullDay, nextDaysAhead, countdown, hoursUntilNext, broadcasterName, use24Hour, skipToday } = args;
  void args.avgDurationHours;
  const start = formatHour(medianHour, use24Hour, medianMinute);
  const name = broadcasterName
    ? <span className="broadcaster-name">{broadcasterName}</span>
    : null;
  const lead = name ?? <>Next stream</>;

  if (nextFullDay == null || nextDaysAhead == null) {
    return {
      eyebrow: <>{lead} schedule</>,
      hero: "—",
      heroTone: "dim",
      support: "Not enough history yet",
    };
  }

  // Within the typical window now, no live data — broadcaster might be
  // late or off-schedule today.
  // Reads: "{name} is usually live · Now · around 7:30 PM"
  if (hoursUntilNext !== null && hoursUntilNext <= 0) {
    return {
      eyebrow: <>{lead} is usually live</>,
      hero: "Now",
      support: <>around <strong>{start}</strong></>,
    };
  }

  // Countdown variant removed — hero always shows the day name, never
  // a timer. The schedule text stays calm; live progress is signalled
  // by the red bar in the calendar overlay instead.
  void countdown;

  // Day-name hero — single variant regardless of how close the stream is.
  // Reads: "{name} goes live · Wednesday · around 7:30 PM"
  const heroWord = nextDaysAhead === 1 ? "Tomorrow" : nextFullDay;
  const verb = skipToday ? "goes live again" : "goes live";
  return {
    eyebrow: <>{lead} {verb}</>,
    hero: heroWord,
    support: <>around <strong>{start}</strong></>,
  };
}

export function ScheduleSummary({ summary, use24Hour = false, skipToday = false }: Props) {
  const { topDays, medianHour, avgDurationHours, isEstimate, tz } = summary;
  const nowMs = useMinuteTick();
  const pick = pickNextStream(topDays, medianHour, tz, nowMs, skipToday);
  const nextDate = nextLikelyLiveDate(topDays, medianHour, tz, nowMs, skipToday);
  const countdown = formatCountdown(nextDate, nowMs);
  const hoursUntilNext = nextDate ? (nextDate.getTime() - nowMs) / 3600_000 : null;
  // Used to expose TODAY_GRACE_HOURS without complaining about an unused import.
  void TODAY_GRACE_HOURS;

  const v = buildVariant({
    medianHour,
    medianMinute: summary.medianMinute ?? 0,
    avgDurationHours,
    nextFullDay: pick ? DAY_NAMES_FULL[pick.dow] : null,
    nextDaysAhead: pick ? pick.daysAhead : null,
    countdown,
    hoursUntilNext,
    broadcasterName: summary.broadcasterName,
    use24Hour,
    skipToday,
  });

  return (
    <div className="schedule">
      <div className="schedule-eyebrow">
        {v.eyebrow}
        {isEstimate && " · est"}
      </div>
      <div className={`schedule-hero schedule-hero-${v.heroTone ?? "accent"}`}>{v.hero}</div>
      <div className="schedule-support">{v.support}</div>
    </div>
  );
}
