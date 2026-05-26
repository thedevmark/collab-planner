// Shared narrative builder for the streaming-pattern surface.
//
// Used by:
//   - app/friends/[id]/StreamingPatternCard.tsx
//
// Pure data — no React, no DOM. Each renderer composes the eyebrow → hero →
// support → secondary tiers in its own idiom (Tailwind in-app, CSS classes
// in the extension).
//
// NOTE: The twitch-extension panel (twitch-extension/src/components/
// ScheduleSummary.tsx) currently inlines an equivalent variant builder.
// When updating the variant cases here, mirror the change there too until
// the two surfaces share a build pipeline.

const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// A typical-day stream that starts later than the median is still "going live
// soon" — not skipped forward to the next active day. 3h covers the right half
// of a typical start-time distribution.
const TODAY_GRACE_HOURS = 3;

export function formatHour12(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const h12 = h % 12 || 12;
  return `${h12} ${h >= 12 ? "PM" : "AM"}`;
}

/** Comma-joined day list with "&": ["Sun","Mon"] → "Sundays & Mondays". */
export function formatDayList(topDays: string[]): string {
  if (topDays.length === 0) return "";
  const full = topDays
    .map((d) => DAY_NAMES_FULL[DAY_NAMES_SHORT.indexOf(d)])
    .filter(Boolean) as string[];
  if (full.length === 1) return `${full[0]}s`;
  if (full.length === 2) return `${full[0]}s & ${full[1]}s`;
  return `${full.slice(0, -1).map((d) => `${d}s`).join(", ")} & ${full[full.length - 1]}s`;
}

export function tzDisplayNames(tz: string): { short: string; long: string } {
  try {
    const now = new Date();
    const shortFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" });
    const longFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" });
    const short = shortFmt.formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? tz;
    const long = longFmt.formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? tz;
    return { short, long };
  } catch {
    return { short: tz, long: tz };
  }
}

export function nextLikelyLiveDate(topDays: string[], medianHour: number, now: Date = new Date()): Date | null {
  if (topDays.length === 0) return null;
  const activeDows = topDays
    .map((d) => DAY_NAMES_SHORT.indexOf(d))
    .filter((i) => i !== -1);
  if (activeDows.length === 0) return null;

  const graceMs = TODAY_GRACE_HOURS * 3600_000;
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + i);
    candidate.setHours(medianHour, 0, 0, 0);
    if (candidate.getTime() <= now.getTime() - graceMs) continue;
    if (activeDows.includes(candidate.getDay())) return candidate;
  }
  return null;
}

export function formatCountdown(target: Date | null, nowMs: number): string {
  if (!target) return "";
  const diffMs = target.getTime() - nowMs;
  if (diffMs <= 0) return "any min";
  const totalMin = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export type RelativeWindow = {
  dayLabel: string;
  fullDay: string;
  relative: string;
};

export function nextLikelyRelative(topDays: string[], medianHour: number, now: Date = new Date()): RelativeWindow | null {
  if (topDays.length === 0) return null;
  const activeDows = topDays.map((d) => DAY_NAMES_SHORT.indexOf(d)).filter((i) => i !== -1);
  if (activeDows.length === 0) return null;

  const todayDow = now.getDay();
  const currentHour = now.getHours();

  for (let i = 0; i < 7; i++) {
    const checkDow = (todayDow + i) % 7;
    if (!activeDows.includes(checkDow)) continue;
    if (i === 0 && currentHour >= medianHour + TODAY_GRACE_HOURS) continue;
    const dayLabel = DAY_NAMES_SHORT[checkDow];
    const fullDay = DAY_NAMES_FULL[checkDow];
    let relative: string;
    if (i === 0) {
      const hoursAway = medianHour - currentHour;
      if (hoursAway <= 0) relative = "any minute";
      else if (hoursAway <= 2) relative = "soon";
      else if (hoursAway <= 6) relative = `in ${hoursAway}h`;
      else relative = "tonight";
    } else if (i === 1) relative = "tomorrow";
    else relative = `in ${i} days`;
    return { dayLabel, fullDay, relative };
  }
  return null;
}

export type SchedulePatternKey =
  | "no-pattern"
  | "imminent"
  | "today"
  | "tomorrow"
  | "future";

export type HeroTone = "accent" | "dim" | "live";

export type ScheduleVariantData = {
  key: SchedulePatternKey;
  eyebrow: string;
  hero: string;
  heroTone: HeroTone;
  parts: {
    fullDay?: string;
    dayList?: string;
    start?: string;
    end?: string;
    relative?: string;
    tzShort: string;
    tzLong: string;
  };
};

export function buildScheduleVariantData(args: {
  topDays: string[];
  medianHour: number;
  avgDurationHours: number;
  tz: string;
  now?: Date;
  nowMs?: number;
}): ScheduleVariantData {
  const { topDays, medianHour, avgDurationHours, tz, now = new Date(), nowMs = Date.now() } = args;
  const tzNames = tzDisplayNames(tz);
  const next = nextLikelyRelative(topDays, medianHour, now);
  const nextDate = nextLikelyLiveDate(topDays, medianHour, now);
  const countdown = formatCountdown(nextDate, nowMs);
  const start = formatHour12(medianHour);
  const end = formatHour12(medianHour + Math.max(1, Math.round(avgDurationHours)));
  const dayList = formatDayList(topDays);
  const baseParts = { tzShort: tzNames.short, tzLong: tzNames.long };

  if (!next) {
    return {
      key: "no-pattern",
      eyebrow: "Next likely live",
      hero: "—",
      heroTone: "dim",
      parts: baseParts,
    };
  }

  if (next.relative === "any minute") {
    return {
      key: "imminent",
      eyebrow: "Usually live",
      hero: "Right now",
      heroTone: "accent",
      parts: { ...baseParts, fullDay: next.fullDay, start, end },
    };
  }

  if (
    next.relative === "soon" ||
    next.relative === "tonight" ||
    (next.relative.startsWith("in ") && !next.relative.includes("day"))
  ) {
    return {
      key: "today",
      eyebrow: "Tonight's stream in",
      hero: countdown || next.relative,
      heroTone: "accent",
      parts: { ...baseParts, fullDay: next.fullDay, start },
    };
  }

  if (next.relative === "tomorrow") {
    return {
      key: "tomorrow",
      eyebrow: "Next stream",
      hero: "Tomorrow",
      heroTone: "accent",
      parts: { ...baseParts, fullDay: next.fullDay, start, dayList },
    };
  }

  return {
    key: "future",
    eyebrow: "Next likely live",
    hero: next.fullDay,
    heroTone: "accent",
    parts: { ...baseParts, fullDay: next.fullDay, start, dayList, relative: next.relative },
  };
}
