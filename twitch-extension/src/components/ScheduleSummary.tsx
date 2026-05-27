import { type ReactNode } from "react";
import type { PanelResponse } from "../lib/types";
import { formatHour } from "../lib/format";
import { useMinuteTick } from "../lib/useMinuteTick";

type Summary = Extract<PanelResponse, { status: "ok" }>["summary"];

interface Props {
  summary: Summary;
  use24Hour?: boolean;
  /** When true, the broadcaster is currently live — skip today as a
   *  candidate for "next stream" so the panel points at the NEXT
   *  typical stream after this current one ends. */
  skipToday?: boolean;
}

const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// A typical-day stream that starts later than the median is still "going live
// soon" -not skipped forward to the next active day. 3h covers the right half
// of a typical start-time distribution.
const TODAY_GRACE_HOURS = 3;

/** Find the precise Date of the next likely live slot (viewer's local clock). */
export function nextLikelyLiveDate(topDays: string[], medianHour: number, skipToday = false): Date | null {
  if (topDays.length === 0) return null;
  const activeDows = topDays
    .map((d) => DAY_NAMES_SHORT.indexOf(d))
    .filter((i) => i !== -1);
  if (activeDows.length === 0) return null;

  const now = new Date();
  const graceMs = TODAY_GRACE_HOURS * 3600_000;
  // When broadcaster is currently live we want the NEXT typical day
  // after today, not the current ongoing stream — start from i=1.
  const startI = skipToday ? 1 : 0;
  for (let i = startI; i < 14; i++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + i);
    candidate.setHours(medianHour, 0, 0, 0);
    if (candidate.getTime() <= now.getTime() - graceMs) continue;
    if (activeDows.includes(candidate.getDay())) return candidate;
  }
  return null;
}

/** Format the countdown in long sentence-case words.
 *  Examples: "47 minutes", "2 hours and 38 minutes", "1 day and 1 hour",
 *  "2 days and 3 hours", "any minute". Plural-aware; hides minutes when
 *  days > 0 to keep it readable. */
export function formatCountdown(target: Date | null, nowMs: number): string {
  if (!target) return "";
  const diffMs = target.getTime() - nowMs;
  if (diffMs <= 0) return "any minute";
  const totalMin = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const mins = totalMin % 60;

  const word = (n: number, singular: string) => `${n} ${n === 1 ? singular : `${singular}s`}`;
  const parts: string[] = [];
  if (days > 0) parts.push(word(days, "day"));
  if (hours > 0) parts.push(word(hours, "hour"));
  if (mins > 0 && days === 0) parts.push(word(mins, "minute"));
  if (parts.length === 0) return "any minute";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} and ${parts[1]}`;
}

function nextLikelyRelative(topDays: string[], medianHour: number, skipToday = false): { dayLabel: string; fullDay: string; relative: string } | null {
  if (topDays.length === 0) return null;
  const activeDows = topDays.map((d) => DAY_NAMES_SHORT.indexOf(d)).filter((i) => i !== -1);
  if (activeDows.length === 0) return null;

  const now = new Date();
  const todayDow = now.getDay();
  const currentHour = now.getHours();
  // Same skip-today behavior as nextLikelyLiveDate for the live state.
  const startI = skipToday ? 1 : 0;

  for (let i = startI; i < 7; i++) {
    const checkDow = (todayDow + i) % 7;
    if (!activeDows.includes(checkDow)) continue;
    if (i === 0 && currentHour >= medianHour + TODAY_GRACE_HOURS) continue;
    const dayLabel = DAY_NAMES_SHORT[checkDow];
    const fullDay = DAY_NAMES_FULL[checkDow];
    let relative: string;
    if (i === 0) {
      const hoursAway = medianHour - currentHour;
      if (hoursAway <= 0) relative = "any minute";
      else if (hoursAway <= 2) relative = "soon";
      else if (hoursAway <= 6) relative = `in ${hoursAway}h`;
      else relative = "tonight";
    } else if (i === 1) relative = "tomorrow";
    else relative = `in ${i} days`;
    return { dayLabel, fullDay, relative };
  }
  return null;
}

type HeroTone = "accent" | "dim" | "live";

interface Variant {
  eyebrow: ReactNode;
  hero: string;
  heroTone?: HeroTone;
  support: ReactNode;
  secondary?: ReactNode;
}

function buildVariant(args: {
  medianHour: number;
  medianMinute: 0 | 30;
  avgDurationHours: number;
  next: ReturnType<typeof nextLikelyRelative>;
  countdown: string;
  hoursUntilNext: number | null;
  broadcasterName: string | null;
  use24Hour: boolean;
}): Variant {
  const { medianHour, medianMinute, avgDurationHours, next, countdown, hoursUntilNext, broadcasterName, use24Hour } = args;
  const start = formatHour(medianHour, use24Hour, medianMinute);
  const end = formatHour(medianHour + Math.max(1, Math.round(avgDurationHours)), use24Hour, medianMinute);
  // Personalized lead: "{broadcaster} goes live" wraps the day-name
  // variants (tomorrow / later). The name itself gets a subtle white
  // glow (.broadcaster-name) so it visually anchors the eyebrow.
  const name = broadcasterName
    ? <span className="broadcaster-name">{broadcasterName}</span>
    : null;
  const goesLive = name ? <>{name} goes live</> : <>Next stream</>;

  if (!next) {
    return {
      eyebrow: name ? <>{name} - no pattern yet</> : "Next stream",
      hero: "—",
      heroTone: "dim",
      support: "Not enough broadcast history to predict yet.",
    };
  }

  if (next.relative === "any minute") {
    return {
      eyebrow: name ? <>{name} is usually live</> : "Usually live",
      hero: "Right now",
      support: <><strong>{start} to {end}</strong>.</>,
    };
  }

  // 12h threshold: inside that window, the hero flips into a live
  // countdown. Outside, the hero stays calm as "Tomorrow" / "Wednesday"
  // and the eyebrow leads the sentence. 12h ≈ "morning of stream day"
  // for an evening streamer — actionable without being all-day noise.
  const isCountdownActive = hoursUntilNext !== null && hoursUntilNext < 12 && hoursUntilNext >= 0;
  if (isCountdownActive) {
    return {
      eyebrow: name ? <>{name} goes live in</> : "Next stream in",
      hero: countdown || next.relative,
      support: <>around <strong>{start}</strong>.</>,
    };
  }

  if (next.relative === "tomorrow") {
    return {
      eyebrow: goesLive,
      hero: "Tomorrow",
      support: <>around <strong>{start}</strong>.</>,
    };
  }

  return {
    eyebrow: goesLive,
    hero: next.fullDay,
    support: <>around <strong>{start}</strong>.</>,
  };
}

export function ScheduleSummary({ summary, use24Hour = false, skipToday = false }: Props) {
  const { topDays, medianHour, avgDurationHours, isEstimate } = summary;
  const next = nextLikelyRelative(topDays, medianHour, skipToday);
  const nextDate = nextLikelyLiveDate(topDays, medianHour, skipToday);
  const nowMs = useMinuteTick();
  const countdown = formatCountdown(nextDate, nowMs);
  const hoursUntilNext = nextDate ? (nextDate.getTime() - nowMs) / 3600_000 : null;

  const v = buildVariant({
    medianHour,
    medianMinute: summary.medianMinute ?? 0,
    avgDurationHours,
    next,
    countdown,
    hoursUntilNext,
    broadcasterName: summary.broadcasterName,
    use24Hour,
  });

  return (
    <div className="schedule">
      <div className="schedule-eyebrow">
        {v.eyebrow}
        {isEstimate && " (est.)"}
      </div>
      <div className={`schedule-hero schedule-hero-${v.heroTone ?? "accent"}`}>{v.hero}</div>
      <div className="schedule-support">{v.support}</div>
      {v.secondary && <div className="schedule-secondary">{v.secondary}</div>}
    </div>
  );
}
