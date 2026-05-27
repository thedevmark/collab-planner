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
  const span = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  return `Live for ${span}`;
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
const ON_TIME_PHRASES = [
  "Right on time",
  "Locked in",
  "On the air",
  "Welcome in",
  "Catch the show",
];

function pickFromSeed<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

function buildCopy(ctx: LiveContext, liveNow: LiveNow, name: string | null, use24Hour: boolean): LiveCopy {
  // Short eyebrows for live state — fits on one line on a 318px panel
  // without wrap weirdness between inline fragments. Detail moves to
  // the support sentence below.
  const seed = liveNow.startedAt;
  const nameNode = name ? <span className="broadcaster-name">{name}</span> : null;
  const whoSupport = nameNode ? <>{nameNode} </> : null;

  switch (ctx.kind) {
    case "off_day":
      return {
        eyebrow: <>Live now</>,
        support: <>{whoSupport}isn't usually on today. {pickFromSeed(OFF_DAY_PHRASES, seed)}.</>,
      };
    case "early":
      return {
        eyebrow: <>On early</>,
        support: <>{whoSupport}usually starts around <strong>{formatHour(ctx.usualHour, use24Hour)}</strong>. {pickFromSeed(EARLY_PHRASES, seed)}.</>,
      };
    case "late":
      return {
        eyebrow: <>Running late</>,
        support: <>{whoSupport}usually starts around <strong>{formatHour(ctx.usualHour, use24Hour)}</strong>. {pickFromSeed(LATE_PHRASES, seed)}.</>,
      };
    case "on_time":
      return {
        eyebrow: <>On schedule</>,
        support: <>{whoSupport}live right on time. {pickFromSeed(ON_TIME_PHRASES, seed)}.</>,
      };
    case "unknown":
    default:
      return {
        eyebrow: "Live now",
        support: <>Live right now.</>,
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
        {/* Wrapping the eyebrow content in one span makes the flex
            container see just [dot, text-block] — without it, each
            child of the JSX fragment (text + <strong>) becomes its
            own flex item with a 6px gap, which inserts a weird gap
            between "is" and "not usually live today" on wrap. */}
        <span className="live-eyebrow-text">{copy.eyebrow}</span>
      </div>
      <div className="schedule-hero schedule-hero-live">{elapsed}</div>
      <div className="schedule-support">{copy.support}</div>
    </div>
  );
}
