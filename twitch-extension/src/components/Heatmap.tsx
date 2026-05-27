// Horizontal per-day timeline. Seven rows (Sun-Sat), one strip each.
// Stream pills sit at each day's typical start hour spanning its typical
// duration. The time axis sits at the bottom and auto-scales to the data
// window (2h before earliest start → 1h after latest end). A NOW marker
// (label + down-arrow) sits above the rows pointing down at a vertical
// line that drops through every row.
//
// File name kept for git history; intent is "calendar," not heatmap.

import { useMemo, type CSSProperties } from "react";
import { computeAxisRange } from "../lib/calendarAxis";
import { formatHourCompact } from "../lib/format";
import { useMinuteTick } from "../lib/useMinuteTick";
import type { PanelResponse } from "../lib/types";

type Summary = Extract<PanelResponse, { status: "ok" }>["summary"];

type OkResponse = Extract<PanelResponse, { status: "ok" }>;

interface Props {
  perDay: Summary["perDay"] | undefined;
  tz: string;
  sampleSize?: number;
  hasPostedSchedule?: boolean;
  use24Hour?: boolean;
  weekStartsMonday?: boolean;
  /** Half-hour-rounded minute for pill labels, so they read "2:30pm"
   *  when the support sentence says "around 2:30 PM" (consistent). */
  medianMinute?: 0 | 30;
  /** When set, today's strip gets a red live-progress bar from the
   *  stream's start hour to the NOW cursor — the visual signal that
   *  the broadcaster is currently live. The schedule text above stays
   *  identical regardless, since the viewer's primary question is still
   *  "when's the NEXT stream." */
  liveNow?: OkResponse["liveNow"] | null;
}

// 3-char abbreviations with "Thur" for Thursday (disambiguates from
// Tue and reads as a recognizable word, not an abbreviation).
const DAY_LETTERS_SUN = ["Sun", "Mon", "Tue", "Wed", "Thur", "Fri", "Sat"];   // dow order 0..6
const DAY_LETTERS_MON = ["Mon", "Tue", "Wed", "Thur", "Fri", "Sat", "Sun"];   // dow order 1,2,3,4,5,6,0
const DAY_ORDER_SUN = [0, 1, 2, 3, 4, 5, 6];
const DAY_ORDER_MON = [1, 2, 3, 4, 5, 6, 0];
const DOW_BY_SHORT: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

// Cache Intl.DateTimeFormat instances per timezone. Constructing them is
// surprisingly expensive (a few ms each) and the previous implementation
// built two fresh ones inside every render of the Heatmap (which runs
// once a minute via the global tick). Now constructed lazily, once per
// distinct tz, for the lifetime of the panel.
const hourFmtCache = new Map<string, Intl.DateTimeFormat>();
const dowFmtCache = new Map<string, Intl.DateTimeFormat>();
function getHourFmt(tz: string): Intl.DateTimeFormat {
  let f = hourFmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
    hourFmtCache.set(tz, f);
  }
  return f;
}
function getDowFmt(tz: string): Intl.DateTimeFormat {
  let f = dowFmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" });
    dowFmtCache.set(tz, f);
  }
  return f;
}

function nowHourInTz(tz: string, nowMs: number): number {
  const parts = getHourFmt(tz).formatToParts(new Date(nowMs));
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return (h === 24 ? 0 : h) + m / 60;
}

function nowDowInTz(tz: string, nowMs: number): number {
  const w = getDowFmt(tz).formatToParts(new Date(nowMs)).find((p) => p.type === "weekday")?.value ?? "Sun";
  return DOW_BY_SHORT[w] ?? 0;
}

export function Heatmap({ perDay, tz, sampleSize, hasPostedSchedule, use24Hour = false, weekStartsMonday = false, medianMinute = 0, liveNow = null }: Props) {
  // Axis ticks always render on the hour ("4pm", "6pm" — no :30).
  // Pill labels use the broadcaster's medianMinute so they read
  // "7:30pm" when the support sentence says "around 7:30 PM".
  const fmtAxisHour = (h: number) => formatHourCompact(h, use24Hour, 0);
  const fmtPillHour = (h: number) => formatHourCompact(h, use24Hour, medianMinute);
  const nowMs = useMinuteTick();
  const dayLetters = weekStartsMonday ? DAY_LETTERS_MON : DAY_LETTERS_SUN;
  const dayOrder = weekStartsMonday ? DAY_ORDER_MON : DAY_ORDER_SUN;

  // perDay is ≤7 entries so a Map is overkill in theory, but a single
  // O(1) lookup in the render loop beats 7 sequential .find() calls per
  // minute-tick across every viewer's panel. Cheap to build, cheap to use.
  // Memoized BEFORE the early-return so the hook order is stable.
  const byDow = useMemo(() => {
    const m = new Map<number, Summary["perDay"][number]>();
    if (perDay) for (const e of perDay) m.set(e.dow, e);
    return m;
  }, [perDay]);

  // Defensive: backend rolling deploys may serve the old payload shape with
  // no perDay field. Render nothing rather than crash the whole panel.
  if (!perDay || perDay.length === 0) return null;

  const { startHour, endHour } = computeAxisRange(perDay);
  const spanH = endHour - startHour;
  const todayDow = nowDowInTz(tz, nowMs);
  const nowH = nowHourInTz(tz, nowMs);
  const nowInRange = nowH >= startHour && nowH < endHour;
  const nowPct = nowInRange ? ((nowH - startHour) / spanH) * 100 : -1;

  // Live-progress bar: stream-start hour (in tz) → now. Clamped to the
  // visible axis so a stream that started before the axis window still
  // shows a bar from the left edge. Hidden entirely if the stream
  // started in the future (clock skew) or after the axis ends.
  const liveStartH = liveNow ? nowHourInTz(tz, new Date(liveNow.startedAt).getTime()) : null;
  const liveBar = (() => {
    if (!liveNow || liveStartH == null) return null;
    // Clamp start to axis window; if start>now (shouldn't happen), hide.
    const s = Math.max(startHour, Math.min(liveStartH, nowH));
    const e = Math.max(s, Math.min(endHour, nowH));
    if (e <= s) return null;
    return {
      leftPct: ((s - startHour) / spanH) * 100,
      widthPct: ((e - s) / spanH) * 100,
    };
  })();

  // Build axis tick labels every 2 hours, including the start.
  const ticks: Array<{ hour: number; pct: number }> = [];
  for (let h = Math.ceil(startHour / 2) * 2; h < endHour; h += 2) {
    ticks.push({ hour: h, pct: ((h - startHour) / spanH) * 100 });
  }

  // --now-pct on the root so both the top marker and the in-rows line
  // share one source of truth for horizontal position.
  const wrapperStyle = { "--now-pct": nowPct } as CSSProperties;

  return (
    <div className="weekcal" style={wrapperStyle}>
      <div className="weekcal-rows">
        {dayOrder.map((dow, idx) => {
          const letter = dayLetters[idx];
          const entry = byDow.get(dow);
          const isToday = dow === todayDow;
          return (
            <div key={dow} className={`weekcal-row ${isToday ? "weekcal-row-today" : ""}`}>
              <span className={`weekcal-day ${isToday ? "weekcal-day-today" : ""}`}>
                {letter}
              </span>
              <div className="weekcal-strip">
                {ticks.map((t) => (
                  <span
                    key={t.hour}
                    className="weekcal-gridline"
                    style={{ left: `${t.pct}%` }}
                  />
                ))}
                {/* NOW line lives ONLY inside today's strip — "current
                    time" only applies to today, not to other days of
                    the week. */}
                {isToday && nowInRange && (
                  <span className="weekcal-now-line" style={{ left: `${nowPct}%` }} />
                )}
                {/* Live-progress bar: red bar inside today's strip
                    from stream start to NOW. Sits ABOVE the typical
                    pill (z-index in CSS) so the live signal wins
                    visually when both are present. */}
                {isToday && liveBar && (
                  <span
                    className="weekcal-live-bar"
                    style={{ left: `${liveBar.leftPct}%`, width: `${liveBar.widthPct}%` }}
                    title="Live right now"
                  >
                    <span className="weekcal-live-dot" aria-hidden />
                  </span>
                )}
                {entry && (() => {
                  // Pill visual position respects the half-hour offset so a
                  // 2:30 PM start lands halfway between the "2pm" and "3pm"
                  // axis ticks (instead of pinning to the 2pm gridline and
                  // contradicting the "around 2:30 PM" support text).
                  const minuteOffset = medianMinute / 60;
                  const leftPct = ((entry.startHour + minuteOffset - startHour) / spanH) * 100;
                  const widthPct = (entry.durationHours / spanH) * 100;
                  return (
                    <span
                      className={`weekcal-pill weekcal-pill-${entry.confidence}`}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      title={`${fmtPillHour(entry.startHour)}–${fmtPillHour(entry.startHour + entry.durationHours)}${entry.confidence === "low" ? " (projected — low confidence)" : " (projected)"}`}
                    />
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time axis on the BOTTOM, auto-scaled to the data window */}
      <div className="weekcal-axis">
        <span className="weekcal-axis-corner" />
        <div className="weekcal-axis-track">
          {ticks.map((t) => (
            <span key={t.hour} className="weekcal-axis-tick" style={{ left: `${t.pct}%` }}>
              {fmtAxisHour(t.hour)}
            </span>
          ))}
        </div>
      </div>

      {(sampleSize ?? 0) > 0 && (
        <div
          className="weekcal-thin-bar"
          title={`Auto-built from ${sampleSize} ${sampleSize === 1 ? "VOD" : "VODs"}${hasPostedSchedule ? " + posted schedule" : ""}`}
        />
      )}
    </div>
  );
}
