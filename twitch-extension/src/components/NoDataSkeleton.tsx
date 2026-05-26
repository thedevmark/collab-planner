// Empty-state shown when the broadcaster has no analyzable history yet.
// Mirrors the live panel's bones but with em-dashes for every metric — so the
// surface reads as "data slot, currently empty" rather than "something broke".

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export function NoDataSkeleton() {
  return (
    <>
      <div className="schedule skeleton">
        <div className="schedule-toprow">
          <div className="schedule-toprow-left">
            <div className="schedule-label">Next likely live</div>
            <div className="schedule-countdown skeleton-chip">—</div>
          </div>
        </div>
        <div className="schedule-day">—</div>
        <div className="schedule-hero">
          <span className="schedule-hero-num">—</span>
          <span className="schedule-hero-ampm">—</span>
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

      <div className="skeleton-note">Not enough broadcast history yet.</div>
    </>
  );
}
