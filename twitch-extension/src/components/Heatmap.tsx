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
import { pickNextStream } from "../lib/nextStream";
import type { PanelResponse } from "../lib/types";

type Summary = Extract<PanelResponse, { status: "ok" }>["summary"];

type OkResponse = Extract<PanelResponse, { status: "ok" }>;

interface Props {
  perDay: Summary["perDay"] | undefined;
  /** Same array ScheduleSummary uses to pick the hero day word, so the
   *  highlighted pill here always matches the hero word above. */
  topDays: Summary["topDays"];
  medianHour: Summary["medianHour"];
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

export function Heatmap({ perDay, topDays, medianHour, tz, sampleSize, hasPostedSchedule, use24Hour = false, weekStartsMonday = false, medianMinute = 0, liveNow = null }: Props) {
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
  const nowHRaw = nowHourInTz(tz, nowMs);
  // Past-midnight reframe: when the axis extends past 24h (broadcaster
  // streams into the early hours), early-morning clock hours (e.g.
  // 12:23 AM → 0.39) are really hour 24.39 on the continued-day axis.
  // Without this, the NOW cursor disappears every night between
  // midnight and ~3 AM even though it's clearly inside the visible
  // axis range.
  const nowH = (endHour > 24 && nowHRaw < endHour - 24) ? nowHRaw + 24 : nowHRaw;
  const nowInRange = nowH >= startHour && nowH < endHour;
  const nowPct = nowInRange ? ((nowH - startHour) / spanH) * 100 : -1;

  // Live-progress bar: rendered on the day the stream STARTED
  // (not necessarily today). When a stream crosses midnight, today's
  // row is empty (stream is really yesterday's session) and rendering
  // the bar on today would visually misalign with the rest of the
  // schedule. Anchoring to the start-day lets the typical axis stay
  // put — Mon/Wed/Sat pills stay where they belong and the live bar
  // overlays the actual day it started.
  //
  // liveStartHourOfDay is hour-of-day on the start day (0..24).
  // liveElapsedH is hours since stream began — used for bar width
  // independent of midnight crossings.
  const liveStartMs = liveNow ? new Date(liveNow.startedAt).getTime() : null;
  const liveStartDow = liveStartMs != null ? nowDowInTz(tz, liveStartMs) : -1;
  const liveStartHourOfDay = liveStartMs != null ? nowHourInTz(tz, liveStartMs) : 0;
  const liveElapsedH = liveStartMs != null ? (nowMs - liveStartMs) / 3600_000 : 0;
  const liveBar = (() => {
    if (!liveNow || liveStartMs == null) return null;
    const s = Math.max(startHour, Math.min(liveStartHourOfDay, endHour));
    const e = Math.max(s, Math.min(endHour, liveStartHourOfDay + liveElapsedH));
    if (e <= s) return null;
    return {
      leftPct: ((s - startHour) / spanH) * 100,
      widthPct: ((e - s) / spanH) * 100,
    };
  })();

  // NEXT-projected day highlight. Uses the shared pickNextStream so
  // the highlighted pill is GUARANTEED to match the hero word above
  // (no chance of drift between perDay-based logic here and
  // topDays-based logic in ScheduleSummary). Skip today only when
  // the live stream actually started today.
  const liveStartedToday = liveStartDow === todayDow;
  const nextPick = pickNextStream(topDays, medianHour, tz, nowMs, !!liveNow && liveStartedToday);
  const nextDow = nextPick ? nextPick.dow : -1;

  // Tick interval is adaptive: every 2h for typical-sized axes (≤10h)
  // and every 4h for wider ones — keeps the ruler dense enough to read
  // a 4pm-12am window at "4 6 8 10 12" without crowding when the axis
  // is wider (e.g. for late-night streamers running past 3 AM).
  const tickStep = spanH <= 10 ? 2 : 4;
  const ticks: Array<{ hour: number; pct: number }> = [];
  for (let h = Math.ceil(startHour / tickStep) * tickStep; h < endHour; h += tickStep) {
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
                {/* White NOW cursor only when NOT live — when live,
                    the red cursor below takes over and renders at the
                    leading edge of the live bar (which may be on a
                    different row if the stream crossed midnight). */}
                {!liveNow && isToday && nowInRange && (
                  <span
                    className="weekcal-now-line"
                    style={{ left: `${nowPct}%` }}
                  />
                )}
                {/* Live-progress bar renders on the day the stream
                    STARTED (handles midnight crossings — see liveStartDow
                    comment above). Sits above the typical pill via
                    z-index so the live signal wins visually.
                    The pulsing cursor lives INSIDE the bar (anchored to
                    its right edge in CSS) so it automatically tracks
                    the bar's visible width — including the min-width
                    floor that keeps the first 30 min looking like a
                    readable chip instead of a 2px stub. The "LIVE NOW"
                    text is gated by a CSS container query: hidden when
                    the bar is narrow, fades in once there's room. */}
                {dow === liveStartDow && liveBar && (
                  <span
                    className="weekcal-live-bar"
                    style={{
                      left: `${liveBar.leftPct}%`,
                      width: `${liveBar.widthPct}%`,
                    }}
                    title="Live right now"
                  >
                    <span className="weekcal-live-text">LIVE NOW</span>
                    <span className="weekcal-now-line weekcal-now-line-live" />
                  </span>
                )}
                {entry && !(dow === liveStartDow && liveBar) && (() => {
                  // Suppress the projected pill on the live bar's row —
                  // the LIVE NOW bar takes over the slot entirely so we
                  // don't render both overlapping. Future days still
                  // show their normal projected pills (incl. the
                  // accent-highlighted next-up day).
                  // Pill visual position respects the half-hour offset so a
                  // 2:30 PM start lands halfway between the "2pm" and "3pm"
                  // axis ticks (instead of pinning to the 2pm gridline and
                  // contradicting the "around 2:30 PM" support text).
                  const minuteOffset = medianMinute / 60;
                  const leftPct = ((entry.startHour + minuteOffset - startHour) / spanH) * 100;
                  const widthPct = (entry.durationHours / spanH) * 100;
                  // Next-up day gets the strong accent treatment to
                  // visually match the hero text ("Tomorrow" / day name);
                  // every other projected day stays glassy/muted so the
                  // next-up reads as the headline.
                  const isNext = dow === nextDow;
                  return (
                    <span
                      className={`weekcal-pill weekcal-pill-${entry.confidence}${isNext ? " weekcal-pill-next" : ""}`}
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
          title={`Built from ${sampleSize} ${sampleSize === 1 ? "stream" : "streams"}`}
        />
      )}
    </div>
  );
}
