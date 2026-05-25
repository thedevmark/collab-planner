import type { PanelResponse } from "../lib/types";

type Summary = Extract<PanelResponse, { status: "ok" }>["summary"];

interface Props {
  summary: Summary;
  showGame: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function clockParts(hour: number): { h: number; ampm: "AM" | "PM" } {
  // The hour value is already in the broadcaster's timezone (server-computed).
  // AM/PM is derived directly from the local hour — do NOT use Intl for it,
  // because UTC→tz shift can flip the period in many cases.
  return { h: hour % 12 || 12, ampm: hour >= 12 ? "PM" : "AM" };
}

function tzShortName(tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" });
    const parts = fmt.formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function ScheduleSummary({ summary, showGame }: Props) {
  const { topDays, medianHour, tz, topGame, isEstimate, hasPostedSchedule } = summary;
  const { h, ampm } = clockParts(medianHour);
  const tzShort = tzShortName(tz);
  const caption = isEstimate ? "Estimated start time" : "Typical start time";

  return (
    <div className="schedule">
      <div className="schedule-hero">
        <span className="schedule-time">
          <span className="schedule-time-tilde">~</span>
          <span className="schedule-time-h">{h}</span>
          <span className="schedule-time-ampm">{ampm}</span>
        </span>
        {tzShort && <span className="schedule-time-tz">{tzShort}</span>}
        {hasPostedSchedule && (
          <span className="posted-dot" title="Has posted Twitch schedule" />
        )}
      </div>
      <div className="schedule-caption">{caption}</div>

      <div className="day-chips">
        {DAYS.map((d) => (
          <span
            key={d}
            className={`day-chip ${topDays.includes(d) ? "day-chip-active" : ""}`}
          >
            {d}
          </span>
        ))}
      </div>

      {showGame && topGame && <span className="game-chip">{topGame}</span>}
    </div>
  );
}
