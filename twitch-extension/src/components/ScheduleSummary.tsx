import type { PanelResponse } from "../lib/types";

type Summary = Extract<PanelResponse, { status: "ok" }>["summary"];

interface Props {
  summary: Summary;
}

const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function clockParts(hour: number): { h: number; ampm: "AM" | "PM" } {
  return { h: hour % 12 || 12, ampm: hour >= 12 ? "PM" : "AM" };
}

function tzLongName(tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" });
    const parts = fmt.formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

/**
 * Find the next likely live datetime by combining topDays + medianHour.
 * Uses the viewer's local clock for "today" detection — close-enough since
 * the countdown is in days, not minutes. Returns the next active day +
 * days-away count, plus a friendly relative label ("Tonight" / "Tomorrow" /
 * weekday name).
 */
function nextLikelyLive(topDays: string[], medianHour: number): {
  dayLabel: string;
  fullDay: string;
  daysAway: number;
  relative: string;
} | null {
  if (topDays.length === 0) return null;

  const activeDows = topDays
    .map((d) => DAY_NAMES_SHORT.indexOf(d))
    .filter((i) => i !== -1);
  if (activeDows.length === 0) return null;

  const now = new Date();
  const todayDow = now.getDay();
  const currentHour = now.getHours();

  for (let i = 0; i < 7; i++) {
    const checkDow = (todayDow + i) % 7;
    if (!activeDows.includes(checkDow)) continue;
    // If today's slot has already passed, skip to next
    if (i === 0 && currentHour >= medianHour) continue;

    const dayLabel = DAY_NAMES_SHORT[checkDow];
    const fullDay = DAY_NAMES_FULL[checkDow];
    let relative: string;
    if (i === 0) {
      const hoursAway = medianHour - currentHour;
      relative = hoursAway <= 2 ? "soon" : hoursAway <= 6 ? `in ${hoursAway}h` : "tonight";
    } else if (i === 1) {
      relative = "tomorrow";
    } else {
      relative = `in ${i} days`;
    }

    return { dayLabel, fullDay, daysAway: i, relative };
  }

  // Fallback: should never reach (we iterated all 7 days)
  return null;
}

export function ScheduleSummary({ summary }: Props) {
  const { topDays, medianHour, tz, isEstimate, hasPostedSchedule } = summary;
  const { h, ampm } = clockParts(medianHour);
  const tzName = tzLongName(tz);
  const next = nextLikelyLive(topDays, medianHour);

  return (
    <div className="schedule">
      <div className="schedule-label">
        {isEstimate ? "Estimated next live" : "Next likely live"}
        {hasPostedSchedule && (
          <span className="schedule-posted" title="Has posted Twitch schedule">●</span>
        )}
      </div>

      {next && (
        <div className="schedule-day">
          {next.fullDay}
          <span className="schedule-day-rel">· {next.relative}</span>
        </div>
      )}

      <div className="schedule-hero">
        <span className="schedule-hero-tilde">~</span>
        <span className="schedule-hero-num">{h}</span>
        <span className="schedule-hero-ampm">{ampm}</span>
      </div>

      <div className="schedule-sub">{tzName}</div>
    </div>
  );
}
