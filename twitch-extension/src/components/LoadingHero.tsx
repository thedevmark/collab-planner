// Loading state with a minimal spinner + cycling status text.
// Used for both the initial fetch and the "warming" state when the
// backend is computing the cached prediction. The cycling messages
// are flavored as the actual steps the analyzer takes (VOD scan,
// day-of-week binning, median computation, etc.) so it reads as
// "I'm doing something" instead of "wait".

import { useEffect, useState } from "react";

const MESSAGES = [
  "scanning VOD history",
  "binning by day of week",
  "computing median start time",
  "inferring typical duration",
  "cross-checking posted schedule",
  "compiling weekly forecast",
  "smoothing recency curve",
];

interface Props {
  /** ms between message swaps. Lower = more activity. */
  interval?: number;
}

export function LoadingHero({ interval = 1500 }: Props) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % MESSAGES.length), interval);
    return () => clearInterval(id);
  }, [interval]);

  return (
    <div className="loading-hero">
      <div className="loading-spinner" aria-hidden />
      <div className="loading-text" key={idx} aria-live="polite">
        {MESSAGES[idx]}…
      </div>
    </div>
  );
}
