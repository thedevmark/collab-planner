// Horizontal per-day timeline. Seven rows (Sun-Sat), one strip each.
// Stream pills sit at each day's typical start hour spanning its typical
// duration. A vertical NOW needle drops across all rows.
//
// File name kept for git history; intent is "calendar," not heatmap.

import { useEffect, useState } from "react";
import { computeAxisRange } from "../lib/calendarAxis";
import type { PanelResponse } from "../lib/types";

type Summary = Extract<PanelResponse, { status: "ok" }>["summary"];

interface Props {
  perDay: Summary["perDay"] | undefined;
  tz: string;
}

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function fmtHour(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  const h12 = hr % 12 || 12;
  return `${h12}${hr >= 12 ? "p" : "a"}`;
}

/** Hours in the streamer's timezone, derived from a wall-clock string. */
function nowHourInTz(tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
  const parts = fmt.formatToParts(new Date());
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return (h === 24 ? 0 : h) + m / 60;
}

function nowDowInTz(tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" });
  const w = fmt.formatToParts(new Date()).find((p) => p.type === "weekday")?.value ?? "Sun";
  return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[w] ?? 0;
}

export function Heatmap({ perDay, tz }: Props) {
  // Re-render every minute so the NOW needle slides.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Defensive: backend rolling deploys may serve the old payload shape with
  // no perDay field. Render nothing rather than crash the whole panel.
  if (!perDay || perDay.length === 0) return null;

  const { startHour, endHour } = computeAxisRange(perDay);
  const spanH = endHour - startHour;
  const todayDow = nowDowInTz(tz);
  const nowH = nowHourInTz(tz);
  const nowInRange = nowH >= startHour && nowH < endHour;
  const nowPct = nowInRange ? ((nowH - startHour) / spanH) * 100 : -1;

  // Build axis tick labels every 2 hours, including the start.
  const ticks: Array<{ hour: number; pct: number }> = [];
  for (let h = Math.ceil(startHour / 2) * 2; h < endHour; h += 2) {
    ticks.push({ hour: h, pct: ((h - startHour) / spanH) * 100 });
  }

  return (
    <div className="weekcal">
      <div className="weekcal-eyebrow">WEEKLY SCHEDULE</div>
      <div className="weekcal-rows">
        {DAY_LETTERS.map((letter, dow) => {
          const entry = perDay.find((d) => d.dow === dow);
          const isToday = dow === todayDow;
          return (
            <div key={dow} className={`weekcal-row ${isToday ? "weekcal-row-today" : ""}`}>
              <span className={`weekcal-day ${isToday ? "weekcal-day-today" : entry ? "weekcal-day-active" : "weekcal-day-empty"}`}>
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
                {entry && (
                  <span
                    className={`weekcal-pill weekcal-pill-${entry.confidence}`}
                    style={{
                      left: `${((entry.startHour - startHour) / spanH) * 100}%`,
                      width: `${(entry.durationHours / spanH) * 100}%`,
                    }}
                    title={`${fmtHour(entry.startHour)}–${fmtHour(entry.startHour + entry.durationHours)}${entry.confidence === "low" ? " (low confidence)" : ""}`}
                  >
                    <span className="weekcal-pill-label">
                      {fmtHour(entry.startHour)}–{fmtHour(entry.startHour + entry.durationHours)}
                    </span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="weekcal-axis">
        <span className="weekcal-axis-corner" />
        <div className="weekcal-axis-track">
          {ticks.map((t) => (
            <span key={t.hour} className="weekcal-axis-tick" style={{ left: `${t.pct}%` }}>
              {fmtHour(t.hour)}
            </span>
          ))}
          {nowInRange && (
            <>
              <span className="weekcal-now-line" style={{ left: `${nowPct}%` }} />
              <span className="weekcal-now-chip" style={{ left: `${nowPct}%` }}>NOW</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
