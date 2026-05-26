// Empty state — same eyebrow/hero/support shape as the live & schedule
// surfaces, just with a dim em-dash hero so it reads as "intentionally blank,
// not broken."

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export function NoDataSkeleton() {
  return (
    <>
      <div className="schedule">
        <div className="schedule-eyebrow">Predictions pending</div>
        <div className="schedule-hero schedule-hero-dim">—</div>
        <div className="schedule-support">Not enough broadcast history yet.</div>
        <div className="schedule-secondary">
          Once there are a few streams, this slot turns into a live-by-day forecast.
        </div>
      </div>

      <div className="weekcal skeleton">
        <div className="weekcal-header">
          <div className="weekcal-corner" />
          {DAY_LETTERS.map((letter, i) => (
            <div key={i} className="weekcal-day-label">{letter}</div>
          ))}
        </div>
        <div className="weekcal-body">
          <div className="weekcal-row">
            <div className="weekcal-hour-label">—</div>
            {DAY_LETTERS.map((_, i) => (
              <div key={i} className="weekcal-cell" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
