import type { PanelResponse } from "../lib/types";

type Summary = Extract<PanelResponse, { status: "ok" }>["summary"];

interface Props {
  summary: Summary;
  showGame: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHourInTz(hour: number, tz: string): string {
  // The hour value is already in the broadcaster's timezone (server-computed).
  // Compute AM/PM and 12-hour clock from the hour directly — do NOT use Intl
  // for AM/PM, because the UTC-to-tz conversion would shift the time and
  // cross the AM/PM boundary in many cases.
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;

  // Use Intl only to extract the short TZ name for the broadcaster's zone.
  // Reference any in-zone date; the value just needs to be inside the zone.
  let tzShort = "";
  try {
    const ref = new Date();
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" });
    const parts = fmt.formatToParts(ref);
    tzShort = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    // Invalid TZ — omit the label.
  }

  return tzShort ? `~${h12}${ampm} ${tzShort}` : `~${h12}${ampm}`;
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
