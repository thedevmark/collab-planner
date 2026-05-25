import type { PanelResponse } from "../lib/types";

type Summary = Extract<PanelResponse, { status: "ok" }>["summary"];

interface Props {
  summary: Summary;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

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
 * Detect bimodal / wide-spread hour distributions so we can show a range
 * ("~7-11 PM") instead of a single point when the streamer's hours vary.
 * Returns the median ± half-IQR width of the active hour mass, or null
 * if the distribution is tight (1-2 hour spread).
 */
function hourRange(hourDistribution: number[]): { from: number; to: number } | null {
  const active = hourDistribution
    .map((v, i) => ({ v, i }))
    .filter((x) => x.v > 0.25);
  if (active.length < 4) return null;
  const hours = active.map((a) => a.i).sort((a, b) => a - b);
  const q1 = hours[Math.floor(hours.length * 0.25)];
  const q3 = hours[Math.floor(hours.length * 0.75)];
  if (q3 - q1 < 2) return null;
  return { from: q1, to: q3 };
}

export function ScheduleSummary({ summary }: Props) {
  const { topDays, medianHour, tz, isEstimate, hasPostedSchedule, hourDistribution } = summary;

  const { h, ampm } = clockParts(medianHour);
  const range = hourRange(hourDistribution);
  const tzName = tzLongName(tz);

  const contextLine = topDays.length > 0 ? topDays.join(" · ") : "Various days";

  return (
    <div className="schedule">
      <div className="schedule-days-context">
        {contextLine}
        {hasPostedSchedule && (
          <span className="schedule-posted" title="Has posted Twitch schedule">●</span>
        )}
      </div>

      <div className="schedule-hero">
        {range ? (
          <>
            <span className="schedule-hero-num">~{clockParts(range.from).h}</span>
            <span className="schedule-hero-dash">–</span>
            <span className="schedule-hero-num">{clockParts(range.to).h}</span>
            <span className="schedule-hero-ampm">{clockParts(range.to).ampm}</span>
          </>
        ) : (
          <>
            <span className="schedule-hero-num">~{h}</span>
            <span className="schedule-hero-ampm">{ampm}</span>
          </>
        )}
      </div>

      <div className="schedule-sub">
        {tzName}{isEstimate && " · estimated"}
      </div>

      <div className="schedule-week">
        {DAY_LETTERS.map((letter, i) => {
          const isActive = topDays.includes(DAY_NAMES[i]);
          return (
            <span
              key={i}
              className={isActive ? "schedule-week-active" : "schedule-week-dim"}
            >
              {letter}
            </span>
          );
        })}
      </div>
    </div>
  );
}
