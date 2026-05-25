const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Hour labels — only show at 0/6/12/18; other rows are blank to keep the
// left column tidy.
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
 * 24-row × 7-col grid. Hour labels run down the left margin (12a/6a/12p/6p),
 * day labels across the top (S M T W T F S, Sunday-first).
 *
 * Cell intensity = dayFrequency[day] * hourDistribution[hour]. This assumes
 * day and hour are independent (only marginal distributions are exposed
 * server-side). For most streamers this is accurate enough; a streamer with
 * very different hours on different days may see some false-bright cells.
 * Improving requires computing a true 7×24 matrix in patterns.ts.
 */
export function Heatmap({ hourDistribution, dayFrequency }: Props) {
  const hasData =
    hourDistribution.length === 24 &&
    dayFrequency.length === 7 &&
    (hourDistribution.some((v) => v > 0) || dayFrequency.some((v) => v > 0));
  if (!hasData) return null;

  return (
    <div className="heatmap">
      <div className="heatmap-day-header">
        <span className="heatmap-corner" />
        {DAY_LABELS.map((d, i) => (
          <span key={i} className="heatmap-day-label">{d}</span>
        ))}
      </div>
      <div className="heatmap-body">
        {Array.from({ length: 24 }, (_, hour) => (
          <div className="heatmap-hour-row" key={hour}>
            <span className="heatmap-hour-label">{HOUR_LABELS[hour] ?? ""}</span>
            {Array.from({ length: 7 }, (_, day) => {
              const intensity = dayFrequency[day] * hourDistribution[hour];
              return (
                <span
                  key={day}
                  className="heatmap-cell"
                  style={{ opacity: Math.max(0.06, Math.min(1, intensity)) }}
                  title={`${DAY_LABELS[day]} ${hour}:00 — ${Math.round(intensity * 100)}%`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
