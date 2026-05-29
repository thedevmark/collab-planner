// Shared "next typical stream" picker. Both ScheduleSummary (hero
// text) and Heatmap (next-up pill highlight) consume this so they
// can never drift. Everything compares in the broadcaster's tz —
// medianHour and topDays are broadcaster-local, so viewer-local
// clocks would shift the answer for viewers in distant timezones.

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_BY_SHORT: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export const TODAY_GRACE_HOURS = 3;

export interface NextStreamPick {
  /** Day of week (0-6, Sun-Sat). */
  dow: number;
  /** Offset from today in days — 0 = today, 1 = tomorrow, etc. */
  daysAhead: number;
}

function dowInTz(tz: string, ms: number): number {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" });
  const w = fmt.formatToParts(new Date(ms)).find((p) => p.type === "weekday")?.value ?? "Sun";
  return DOW_BY_SHORT[w] ?? 0;
}

function hourInTz(tz: string, ms: number): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(new Date(ms));
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return (h === 24 ? 0 : h) + m / 60;
}

export function pickNextStream(
  topDays: string[],
  medianHour: number,
  tz: string,
  nowMs: number,
  skipToday: boolean,
): NextStreamPick | null {
  const activeDows = topDays
    .map((d) => DAY_NAMES_SHORT.indexOf(d))
    .filter((i) => i !== -1);
  if (activeDows.length === 0) return null;
  const todayDow = dowInTz(tz, nowMs);
  const currentHour = hourInTz(tz, nowMs);
  const startI = skipToday ? 1 : 0;
  for (let i = startI; i < 7; i++) {
    const dow = (todayDow + i) % 7;
    if (!activeDows.includes(dow)) continue;
    if (i === 0 && currentHour >= medianHour + TODAY_GRACE_HOURS) continue;
    return { dow, daysAhead: i };
  }
  return null;
}
