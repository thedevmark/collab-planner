import type { PanelResponse } from "../lib/types";

type Summary = Extract<PanelResponse, { status: "ok" }>["summary"];

interface Props {
  summary: Summary;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Convert a UTC hour to a short "~h AM/PM" label in the viewer's local
 * timezone — mirrors the format used on collab.deutschmark.online's friend
 * cards ("Streams Sun, Tue, Mon ~6PM").
 */
function localHourLabel(hourUtc: number): string {
  const d = new Date();
  d.setUTCHours(hourUtc, 0, 0, 0);
  const local = d.getHours();
  const h = local % 12 || 12;
  return `~${h}${local >= 12 ? "PM" : "AM"}`;
}

export function ScheduleSummary({ summary }: Props) {
  const { topDays, medianHourUtc, topGame, isEstimate, hasPostedSchedule } = summary;
  const timeLabel = localHourLabel(medianHourUtc);
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

      {topGame && <span className="game-chip">{topGame}</span>}
    </div>
  );
}
