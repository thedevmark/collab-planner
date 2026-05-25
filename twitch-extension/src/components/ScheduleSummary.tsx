import type { PanelResponse } from "../lib/types";

type Summary = Extract<PanelResponse, { status: "ok" }>["summary"];

interface Props {
  summary: Summary;
  showGame: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Format a broadcaster-local clock hour with a short timezone label
 * (e.g. "~7PM EST"). We use a reference Date at hour:00:00 UTC then format
 * it in the broadcaster's IANA timezone to extract the AM/PM and TZ short
 * name. Note: the hour value we receive is ALREADY in the broadcaster's tz
 * (set server-side in patterns.ts), so we just need a label.
 */
function formatHourInTz(hour: number, tz: string): string {
  // Build a stable reference date in UTC such that its tz-local hour equals `hour`.
  // We use Intl to format an arbitrary date in the tz, picking the AM/PM + tzShort
  // for the hour value the server already computed.
  const ref = new Date();
  ref.setUTCHours(hour, 0, 0, 0);
  // Try to render hour + AM/PM + TZ short name in the broadcaster's tz.
  // Note: because the hour value is broadcaster-local (not UTC), we display
  // it directly and rely on Intl just for the AM/PM and tz label.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: true,
    timeZoneName: "short",
  });
  const parts = fmt.formatToParts(ref);
  const ampm = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
  const tzShort = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  const h12 = hour % 12 || 12;
  return `~${h12}${ampm} ${tzShort}`.trim();
}

export function ScheduleSummary({ summary, showGame }: Props) {
  const { topDays, medianHour, tz, topGame, isEstimate, hasPostedSchedule } = summary;
  const timeLabel = formatHourInTz(medianHour, tz);
  const lead = isEstimate ? "Est." : "Streams";
  const daysJoined = topDays.length > 0 ? topDays.join(", ") : "various days";

  return (
    <div className="schedule">
      <div className="schedule-line">
        <span className="trend-arrow" aria-hidden="true">↗</span>
        <span>{lead} {daysJoined} {timeLabel}</span>
        {hasPostedSchedule && <span className="posted-dot" title="Has posted Twitch schedule" />}
      </div>

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
