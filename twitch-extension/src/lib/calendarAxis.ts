import type { PanelResponse } from "./types";

type PerDayEntry = Extract<PanelResponse, { status: "ok" }>["summary"]["perDay"][number];

export interface AxisRange {
  /** Inclusive hour offset (may exceed 24 for past-midnight schedules). */
  startHour: number;
  /** Exclusive hour offset. */
  endHour: number;
}

const MIN_SPAN_HOURS = 10;
const PAD_BEFORE = 2;
const PAD_AFTER = 1;

/**
 * Compute the time axis for the calendar based on perDay entries.
 *
 * Rule: 2h before the earliest high-confidence start → 1h after the latest
 * high-confidence end, clamped to a 10h minimum span so the layout doesn't
 * collapse on a single short stream. Low-confidence entries don't drive the
 * window (they'd skew it toward noise) but they do still render inside it.
 *
 * Falls back to 12pm-12am when there are no high-confidence entries (or none
 * at all) so the calendar still has somewhere to draw.
 */
export function computeAxisRange(perDay: PerDayEntry[]): AxisRange {
  const high = perDay.filter((d) => d.confidence === "high");
  if (high.length === 0) {
    return { startHour: 12, endHour: 24 };
  }

  const earliestStart = Math.min(...high.map((d) => d.startHour));
  const latestEnd = Math.max(...high.map((d) => d.startHour + d.durationHours));

  let startHour = earliestStart - PAD_BEFORE;
  const endHour = latestEnd + PAD_AFTER;

  // Only enforce the minimum span for same-day schedules (endHour <= 24).
  // Past-midnight streams (endHour > 24) already represent an unusual span
  // and should not be re-centered — the padding result is used as-is.
  if (endHour <= 24 && endHour - startHour < MIN_SPAN_HOURS) {
    startHour = Math.max(0, endHour - MIN_SPAN_HOURS);
  }

  return { startHour, endHour };
}
