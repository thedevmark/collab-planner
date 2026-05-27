// Empty state — same eyebrow/hero/support shape as the live & schedule
// surfaces, just with a dim em-dash hero so it reads as "intentionally
// blank, not broken." The copy hints at "could be timing, refresh in a
// minute" because the most common cause is the prediction cache still
// warming up on first viewer for this channel — not actual absence of
// broadcast history.

const DAY_LETTERS = ["Sun", "Mon", "Tue", "Wed", "Th", "Fri", "Sat"];

export function NoDataSkeleton() {
  return (
    <>
      <div className="schedule skeleton-schedule">
        <div className="schedule-eyebrow">Forecast warming up</div>
        <div className="schedule-hero schedule-hero-dim">—</div>
        <div className="schedule-support">Crunching broadcast history.</div>
        <div className="schedule-secondary">Refresh in a minute.</div>
      </div>

      <div className="weekcal skeleton">
        <div className="weekcal-rows">
          {DAY_LETTERS.map((letter, i) => (
            <div key={i} className="weekcal-row">
              <span className="weekcal-day weekcal-day-empty">{letter}</span>
              <div className="weekcal-strip" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
