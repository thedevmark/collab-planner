// Single shared minute-boundary clock for the whole panel.
//
// Why: pre-optimization the panel had several independent setIntervals —
// one each in ScheduleSummary, Heatmap, and others — all firing every ~60s
// but on different (mount-time-anchored) cadences.
// That meant 4× the timer overhead and 4× the React re-renders, plus the
// "as of" clock drifted up to a full minute behind the real wall clock
// because nothing was aligned to actual :00 seconds.
//
// One module-level scheduler now anchors to true minute boundaries and
// fans out to every subscriber synchronously.
//
// Footprint: one timer for the entire panel, regardless of how many
// components subscribe.

import { useEffect, useState } from "react";

type Subscriber = (nowMs: number) => void;

const subscribers = new Set<Subscriber>();
let timeoutId: ReturnType<typeof setTimeout> | null = null;

function scheduleNextTick() {
  // Wake at the next true minute boundary so the displayed clock matches
  // the wall clock within ~1s, regardless of when the first subscriber
  // happened to mount.
  const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
  timeoutId = setTimeout(() => {
    const now = Date.now();
    for (const fn of subscribers) fn(now);
    if (subscribers.size > 0) scheduleNextTick();
    else timeoutId = null;
  }, msUntilNextMinute);
}

function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  if (timeoutId === null) scheduleNextTick();
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0 && timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}

/** Returns a number that updates at every minute boundary. Use as the
 *  reactive "now" source for any component that needs to re-render on
 *  the minute (countdowns, "as of" clock, NOW needle, elapsed live, …). */
export function useMinuteTick(): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => subscribe(setNowMs), []);
  return nowMs;
}
