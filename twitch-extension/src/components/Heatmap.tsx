// Renamed conceptually: this is a weekly calendar (iOS-style) showing
// typical stream windows as time blocks, not a heatmap. File name kept
// so panel.tsx import doesn't move; component export name is unchanged.

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  topDays: string[];          // ["Sun", "Mon", "Wed"] — days the streamer is active
  medianHour: number;         // 0-23, typical start hour in broadcaster's tz
  avgDurationHours: number;   // typical session length
  dayFrequency: number[];     // length 7, 0-1, varies block opacity per day
}

function formatHourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const h12 = h % 12 || 12;
  return `${h12}${h >= 12 ? "PM" : "AM"}`;
}

// Visual: 7 day columns × N hour rows. Each active day gets a single
// rounded block from medianHour to medianHour+avgDurationHours.
const ROW_HEIGHT = 22; // px per hour
const HOURS_BEFORE = 1; // hours of padding above the typical start
const HOURS_AFTER = 2;  // hours of padding below the typical end

export function Heatmap({ topDays, medianHour, avgDurationHours, dayFrequency }: Props) {
  if (topDays.length === 0) return null;

  // Snap duration to whole hours, minimum 1.
  const duration = Math.max(1, Math.round(avgDurationHours));
  const visibleHours = HOURS_BEFORE + duration + HOURS_AFTER;
  const startHourOffset = medianHour - HOURS_BEFORE;

  // Hour labels for each visible row (wrapping past midnight)
  const hourRows = Array.from({ length: visibleHours }, (_, i) => {
    return ((startHourOffset + i) % 24 + 24) % 24;
  });

  const bodyHeight = visibleHours * ROW_HEIGHT;

  return (
    <div className="weekcal">
      <div className="weekcal-header">
        <span className="weekcal-corner" />
        {DAY_LETTERS.map((label, i) => {
          const isActive = topDays.includes(DAY_NAMES[i]);
          return (
            <span
              key={i}
              className={`weekcal-day-label ${isActive ? "weekcal-day-label-active" : ""}`}
            >
              {label}
            </span>
          );
        })}
      </div>

      <div className="weekcal-body" style={{ height: bodyHeight }}>
        <div className="weekcal-hours">
          {hourRows.map((h, i) => (
            <div key={i} className="weekcal-hour" style={{ top: i * ROW_HEIGHT }}>
              {formatHourLabel(h)}
            </div>
          ))}
        </div>

        <div className="weekcal-days">
          {DAY_NAMES.map((dayName, dayIdx) => {
            const isActive = topDays.includes(dayName);
            const opacity = isActive
              ? Math.min(1, 0.55 + 0.45 * (dayFrequency[dayIdx] ?? 0))
              : 0;
            return (
              <div key={dayIdx} className="weekcal-day-col">
                {hourRows.map((_, i) => (
                  <div
                    key={i}
                    className="weekcal-hourline"
                    style={{ top: i * ROW_HEIGHT }}
                  />
                ))}
                {isActive && (
                  <div
                    className="weekcal-event"
                    style={{
                      top: HOURS_BEFORE * ROW_HEIGHT,
                      height: duration * ROW_HEIGHT - 2,
                      opacity,
                    }}
                    title={`${dayName} ${formatHourLabel(medianHour)} — ${duration}h`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
