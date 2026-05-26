// Week calendar (iOS-style) — Apple Calendar week-view aesthetic.
// File name kept for git history; intent is "calendar," not heatmap.

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  topDays: string[];
  medianHour: number;
  avgDurationHours: number;
  dayFrequency: number[];
}

function formatHourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const h12 = h % 12 || 12;
  return `${h12}${h >= 12 ? "p" : "a"}`;
}

// Show a focused window around the typical stream — 1h padding above the
// start, the duration itself, then 1h padding below the typical end. This
// keeps cells tall enough to read AND keeps the calendar compact.
const HOURS_BEFORE = 0;
const HOURS_AFTER = 0;

export function Heatmap({ topDays, medianHour, avgDurationHours, dayFrequency }: Props) {
  if (topDays.length === 0) return null;

  const duration = Math.max(1, Math.round(avgDurationHours));
  const visibleHours = HOURS_BEFORE + duration + HOURS_AFTER;
  const startHourOffset = medianHour - HOURS_BEFORE;

  const hourRows = Array.from({ length: visibleHours }, (_, i) => {
    return ((startHourOffset + i) % 24 + 24) % 24;
  });

  return (
    <div className="weekcal">
      <div className="weekcal-header">
        <span className="weekcal-corner" />
        {DAY_LETTERS.map((letter, i) => {
          const isActive = topDays.includes(DAY_NAMES[i]);
          return (
            <span
              key={i}
              className={`weekcal-day-label ${isActive ? "weekcal-day-label-active" : ""}`}
            >
              {letter}
            </span>
          );
        })}
      </div>

      <div className="weekcal-body">
        {hourRows.map((hour, rowIdx) => (
          <div className="weekcal-row" key={rowIdx}>
            <span className="weekcal-hour-label">{formatHourLabel(hour)}</span>
            {DAY_NAMES.map((dayName, dayIdx) => {
              const isActive = topDays.includes(dayName);
              const inBlock = isActive
                && rowIdx >= HOURS_BEFORE
                && rowIdx < HOURS_BEFORE + duration;
              const isFirstRow = rowIdx === HOURS_BEFORE;
              const isLastRow = rowIdx === HOURS_BEFORE + duration - 1;
              const opacity = isActive
                ? Math.min(1, 0.6 + 0.4 * (dayFrequency[dayIdx] ?? 0))
                : 1;
              return (
                <span
                  key={dayIdx}
                  className={[
                    "weekcal-cell",
                    inBlock ? "weekcal-cell-on" : "",
                    inBlock && isFirstRow ? "weekcal-cell-top" : "",
                    inBlock && isLastRow ? "weekcal-cell-bottom" : "",
                  ].filter(Boolean).join(" ")}
                  style={inBlock ? { opacity } : undefined}
                  title={isActive && isFirstRow
                    ? `${dayName} ${formatHourLabel(medianHour)} — ${duration}h`
                    : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
