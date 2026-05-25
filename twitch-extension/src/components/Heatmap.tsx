const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Hour-tick labels on the top axis — only show at 0/6/12/18 so we don't crowd.
const HOUR_TICKS = [0, 6, 12, 18];
const HOUR_LABELS: Record<number, string> = {
  0: "12a",
  6: "6a",
  12: "12p",
  18: "6p",
};

interface Props {
  hourDistribution: number[]; // length 24, 0-1
  dayFrequency: number[];     // length 7, 0-1 (index 0 = Sunday)
}

/**
 * GitHub-style contribution-graph layout. 7 rows (days, Sunday-first) by 24
 * columns (hours). Near-square cells with subtle rounding and visible gaps —
 * the panel is too narrow for a 24-row transposed layout, which forced
 * wide-thin cells that looked cramped.
 *
 * Cell intensity = dayFrequency[day] * hourDistribution[hour]. This assumes
 * day and hour are independent (only marginal distributions exposed
 * server-side). A future revision could compute a true 7×24 matrix in
 * patterns.ts for streamers whose hours vary a lot day-to-day.
 */
export function Heatmap({ hourDistribution, dayFrequency }: Props) {
  const hasData =
    hourDistribution.length === 24 &&
    dayFrequency.length === 7 &&
    (hourDistribution.some((v) => v > 0) || dayFrequency.some((v) => v > 0));
  if (!hasData) return null;

  return (
    <div className="heatmap">
      <div className="heatmap-axis-top">
        <span className="heatmap-corner" />
        <div className="heatmap-hour-ticks">
          {HOUR_TICKS.map((h) => (
            <span
              key={h}
              className="heatmap-hour-tick"
              style={{ left: `${(h / 24) * 100}%` }}
            >
              {HOUR_LABELS[h]}
            </span>
          ))}
        </div>
      </div>
      <div className="heatmap-rows">
        {DAY_LABELS.map((label, day) => (
          <div className="heatmap-row" key={day}>
            <span className="heatmap-day-label">{label}</span>
            <div className="heatmap-cells">
              {Array.from({ length: 24 }, (_, hour) => {
                const intensity = dayFrequency[day] * hourDistribution[hour];
                return (
                  <span
                    key={hour}
                    className="heatmap-cell"
                    style={{ opacity: Math.max(0.06, Math.min(1, intensity)) }}
                    title={`${label} ${hour}:00 — ${Math.round(intensity * 100)}%`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
