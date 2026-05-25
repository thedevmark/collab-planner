import { useEffect, useState } from "react";
import type { PanelResponse } from "../lib/types";

type Summary = Extract<PanelResponse, { status: "ok" }>["summary"];

interface Props {
  summary: Summary;
}

const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function clockParts(hour: number): { h: number; ampm: "AM" | "PM" } {
  return { h: hour % 12 || 12, ampm: hour >= 12 ? "PM" : "AM" };
}

function tzLongName(tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" });
    const parts = fmt.formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

/** Find the precise Date of the next likely live slot (viewer's local clock). */
function nextLikelyLiveDate(topDays: string[], medianHour: number): Date | null {
  if (topDays.length === 0) return null;
  const activeDows = topDays
    .map((d) => DAY_NAMES_SHORT.indexOf(d))
    .filter((i) => i !== -1);
  if (activeDows.length === 0) return null;

  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + i);
    candidate.setHours(medianHour, 0, 0, 0);
    if (candidate.getTime() <= now.getTime()) continue;
    if (activeDows.includes(candidate.getDay())) return candidate;
  }
  return null;
}

/** Format hh:mm style countdown ("4h 23m", "47m", "2d 3h"). */
function formatCountdown(target: Date | null, nowMs: number): string {
  if (!target) return "";
  const diffMs = target.getTime() - nowMs;
  if (diffMs <= 0) return "live now?";
  const totalMin = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function nextLikelyRelative(topDays: string[], medianHour: number): { dayLabel: string; fullDay: string; relative: string } | null {
  if (topDays.length === 0) return null;
  const activeDows = topDays.map((d) => DAY_NAMES_SHORT.indexOf(d)).filter((i) => i !== -1);
  if (activeDows.length === 0) return null;

  const now = new Date();
  const todayDow = now.getDay();
  const currentHour = now.getHours();

  for (let i = 0; i < 7; i++) {
    const checkDow = (todayDow + i) % 7;
    if (!activeDows.includes(checkDow)) continue;
    if (i === 0 && currentHour >= medianHour) continue;
    const dayLabel = DAY_NAMES_SHORT[checkDow];
    const fullDay = DAY_NAMES_FULL[checkDow];
    let relative: string;
    if (i === 0) {
      const hoursAway = medianHour - currentHour;
      relative = hoursAway <= 2 ? "soon" : hoursAway <= 6 ? `in ${hoursAway}h` : "tonight";
    } else if (i === 1) relative = "tomorrow";
    else relative = `in ${i} days`;
    return { dayLabel, fullDay, relative };
  }
  return null;
}

export function ScheduleSummary({ summary }: Props) {
  const { topDays, medianHour, tz, isEstimate, hasPostedSchedule, broadcasterAvatar } = summary;
  const { h, ampm } = clockParts(medianHour);
  const tzName = tzLongName(tz);
  const next = nextLikelyRelative(topDays, medianHour);
  const nextDate = nextLikelyLiveDate(topDays, medianHour);

  // Re-render once a minute so the countdown stays current
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const countdown = formatCountdown(nextDate, nowMs);

  return (
    <div className="schedule">
      <div className="schedule-toprow">
        <div className="schedule-toprow-left">
          <div className="schedule-label">
            {isEstimate ? "Estimated next live" : "Next likely live"}
            {hasPostedSchedule && (
              <span className="schedule-posted" title="Has posted Twitch schedule">●</span>
            )}
          </div>
          {countdown && <div className="schedule-countdown">{countdown}</div>}
        </div>
        {broadcasterAvatar && (
          <img className="schedule-avatar" src={broadcasterAvatar} alt="" loading="lazy" />
        )}
      </div>

      {next && (
        <div className="schedule-day">
          {next.fullDay}
          <span className="schedule-day-rel">· {next.relative}</span>
        </div>
      )}

      <div className="schedule-hero">
        <span className="schedule-hero-tilde">~</span>
        <span className="schedule-hero-num">{h}</span>
        <span className="schedule-hero-ampm">{ampm}</span>
      </div>

      <div className="schedule-sub">{tzName}</div>
    </div>
  );
}
