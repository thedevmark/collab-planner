const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

interface Props {
  hourDistribution: number[]; // length 24, 0-1
  dayFrequency: number[];     // length 7, 0-1 (index 0 = Sunday)
}

/**
 * NOTE: We only have marginal distributions (day and hour separately), not a
 * true 2D day×hour matrix. The cell intensity is computed as the product
 * `dayFrequency[day] * hourDistribution[hour]`, which assumes day and hour
 * are independent. This isn't perfectly accurate (a streamer who does
 * "Sunday 7pm" and "Saturday morning" will show false intensity at "Saturday
 * 7pm") but is a reasonable v1 approximation. A future revision could compute
 * the true 2D matrix server-side in patterns.ts.
 */
export function Heatmap({ hourDistribution, dayFrequency }: Props) {
  // Render nothing if both arrays are flat/empty (no data)
  const hasData =
    hourDistribution.length === 24 &&
    dayFrequency.length === 7 &&
    (hourDistribution.some((v) => v > 0) || dayFrequency.some((v) => v > 0));
  if (!hasData) return null;

  return (
    <div className="heatmap">
      <div className="heatmap-header">
        <span className="heatmap-label-spacer" />
        <span className="heatmap-h">12a</span>
        <span className="heatmap-h">6a</span>
        <span className="heatmap-h">12p</span>
        <span className="heatmap-h">6p</span>
      </div>
      <div className="heatmap-grid">
        {DAY_LABELS.map((label, day) => (
          <div className="heatmap-row" key={day}>
            <span className="heatmap-day-label">{label}</span>
            {Array.from({ length: 24 }, (_, hour) => {
              const intensity = dayFrequency[day] * hourDistribution[hour];
              return (
                <span
                  key={hour}
                  className="heatmap-cell"
                  style={{ opacity: Math.max(0.05, Math.min(1, intensity)) }}
                  title={`${label} ${hour}:00 — ${Math.round(intensity * 100)}%`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
