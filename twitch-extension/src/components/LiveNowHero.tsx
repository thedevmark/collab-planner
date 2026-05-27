import { type ReactNode } from "react";
import type { PanelResponse } from "../lib/types";
import { formatHour } from "../lib/format";
import { useMinuteTick } from "../lib/useMinuteTick";

type OkResponse = Extract<PanelResponse, { status: "ok" }>;
type Summary = OkResponse["summary"];
type LiveNow = NonNullable<OkResponse["liveNow"]>;

interface Props {
  liveNow: LiveNow;
  summary: Summary;
  use24Hour?: boolean;
}

function formatElapsed(startedAtMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - startedAtMs);
  const totalMin = Math.floor(diff / 60_000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function nowDowInTz(tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" });
  const w = fmt.formatToParts(new Date()).find((p) => p.type === "weekday")?.value ?? "Sun";
  return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[w] ?? 0;
}
function nowHourInTz(tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false });
  const h = parseInt(fmt.formatToParts(new Date()).find((p) => p.type === "hour")?.value ?? "0", 10);
  return h === 24 ? 0 : h;
}

/** Classify the current live moment against the broadcaster's typical pattern.
 *  Used to pick more interesting copy than a generic "Live now". */
type LiveContext =
  | { kind: "on_time" }                                // currently in their typical window
  | { kind: "off_day" }                                // not a day they usually stream
  | { kind: "early"; usualHour: number }              // their day, hours before usual
  | { kind: "late"; usualHour: number }               // their day, hours after usual
  | { kind: "unknown" };                              // not enough data to classify
function classify(summary: Summary): LiveContext {
  const { perDay, tz } = summary;
  if (!perDay || perDay.length === 0) return { kind: "unknown" };
  const dow = nowDowInTz(tz);
  const hour = nowHourInTz(tz);
  const entry = perDay.find((d) => d.dow === dow);
  if (!entry) return { kind: "off_day" };
  const start = entry.startHour;
  const end = entry.startHour + entry.durationHours;
  if (hour >= start - 0.5 && hour < end + 0.5) return { kind: "on_time" };
  if (hour < start) return { kind: "early", usualHour: start };
  return { kind: "late", usualHour: start };
}


interface LiveCopy {
  eyebrow: ReactNode;
  support: ReactNode;
}

// Rotating "feel" phrases per live context. Five each, picked
// deterministically from the stream's startedAt so the same session
// always shows the same phrase across reloads (no jitter), but every
// new stream gets a different one.
const OFF_DAY_PHRASES = [
  "What a treat",
  "Surprise stream",
  "Unexpected drop",
  "Bonus stream tonight",
  "Off-script tonight",
];
const EARLY_PHRASES = [
  "Going live early",
  "Ahead of schedule",
  "Jumped on early",
  "Early start tonight",
  "Beating the clock",
];
const LATE_PHRASES = [
  "Running late",
  "Late start tonight",
  "Just got going",
  "Catching up",
  "Off to a slow start",
];
const ON_TIME_VERBS = [
  "Streaming",
  "Playing",
  "Live with",
  "Tonight:",
  "Now playing",
];

function pickFromSeed<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

function buildCopy(ctx: LiveContext, liveNow: LiveNow, name: string | null, use24Hour: boolean): LiveCopy {
  const who = name ?? "this streamer";
  const game = liveNow.gameName;
  const seed = liveNow.startedAt;

  switch (ctx.kind) {
    case "off_day": {
      const phrase = pickFromSeed(OFF_DAY_PHRASES, seed);
      return {
        eyebrow: <>{who} is <strong>not usually live today</strong></>,
        support: game
          ? <>{phrase} — <strong>{game}</strong>.</>
          : <>{phrase}.</>,
      };
    }
    case "early": {
      const phrase = pickFromSeed(EARLY_PHRASES, seed);
      return {
        eyebrow: <>{who} is on <strong>early today</strong></>,
        support: game
          ? <>{phrase} — <strong>{game}</strong>.</>
          : <>{phrase} — usually around <strong>{formatHour(ctx.usualHour, use24Hour)}</strong>.</>,
      };
    }
    case "late": {
      const phrase = pickFromSeed(LATE_PHRASES, seed);
      return {
        eyebrow: <>{who} is <strong>running late</strong></>,
        support: game
          ? <>{phrase} — <strong>{game}</strong>.</>
          : <>{phrase} — usually around <strong>{formatHour(ctx.usualHour, use24Hour)}</strong>.</>,
      };
    }
    case "on_time": {
      const verb = pickFromSeed(ON_TIME_VERBS, seed);
      return {
        eyebrow: <>{who} is live <strong>right on time</strong></>,
        support: game ? <>{verb} <strong>{game}</strong>.</> : <>Live now.</>,
      };
    }
    case "unknown":
    default:
      return {
        eyebrow: "Live now",
        support: game ? <>Streaming <strong>{game}</strong>.</> : <>Live right now.</>,
      };
  }
}

export function LiveNowHero({ liveNow, summary, use24Hour = false }: Props) {
  const startedAtMs = new Date(liveNow.startedAt).getTime();
  const nowMs = useMinuteTick();
  const elapsed = formatElapsed(startedAtMs, nowMs);
  const ctx = classify(summary);
  const copy = buildCopy(ctx, liveNow, summary.broadcasterName, use24Hour);

  return (
    <div className="schedule live-hero">
      <div className="schedule-eyebrow live-eyebrow">
        <span className="live-dot" aria-hidden />
        {copy.eyebrow}
      </div>
      <div className="schedule-hero schedule-hero-live">{elapsed}</div>
      <div className="schedule-support">{copy.support}</div>
    </div>
  );
}
