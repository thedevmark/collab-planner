const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS_PER_DAY = 24;
const DEFAULT_DURATION_HOURS = 3;

const DAY_NAME_TO_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function partsInTz(date: Date, timeZone: string): { dayIndex: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  let hour = parseInt(hourStr, 10);
  if (hour === 24) hour = 0; // Intl quirk: midnight is sometimes "24"
  return { dayIndex: DAY_NAME_TO_INDEX[weekday] ?? 0, hour };
}

const DAY_NAME_TO_INDEX_FULL: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

function computePerDay(
  sessions: StreamSession[],
  typicalDays: string[],
  timezone: string
): StreamingPattern["perDay"] {
  // Only consider days the streamer is *currently* known for, derived from
  // the recency-weighted typicalDays. This prevents stale historical days
  // (e.g. an old W/T/F pattern) from showing up in the calendar when the
  // streamer has since moved to Mon/Wed/Sun. The calendar should match the
  // schedule-summary copy line for line.
  const allowedDows = new Set(
    typicalDays.map((d) => DAY_NAME_TO_INDEX_FULL[d]).filter((i) => i !== undefined)
  );
  if (allowedDows.size === 0) return [];

  // Group session start hours + durations by dow.
  const byDow = new Map<number, { hours: number[]; durations: number[] }>();
  for (const s of sessions) {
    const { dayIndex, hour } = partsInTz(s.startTime, timezone);
    if (!allowedDows.has(dayIndex)) continue;
    const durationHours = s.durationSec / 3600;
    const bucket = byDow.get(dayIndex) ?? { hours: [], durations: [] };
    bucket.hours.push(hour);
    bucket.durations.push(durationHours);
    byDow.set(dayIndex, bucket);
  }

  function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  return Array.from(byDow.entries())
    .map(([dow, { hours, durations }]) => ({
      dow,
      startHour: median(hours),
      durationHours: Math.max(1, Math.round(median(durations))),
      confidence: (hours.length >= 3 ? "high" : "low") as "high" | "low",
    }))
    .sort((a, b) => a.dow - b.dow);
}

export interface StreamSession {
  startTime: Date;
  endTime: Date;
  gameName: string;
  durationSec: number;
}

export interface ScheduleHint {
  startTime: Date;
  endTime: Date;
  gameName: string;
  isRecurring: boolean;
}

export interface StreamingPattern {
  friendId: number;
  displayName: string;
  /** Days of week sorted by frequency */
  typicalDays: string[];
  /** Typical start hour in the timezone passed to analyzePatterns */
  startHours: { earliest: number; latest: number; median: number };
  /** Average session length in hours */
  avgDurationHours: number;
  /** Top games by frequency */
  topGames: string[];
  /** Confidence tier based on sample size */
  confidence: "strong" | "moderate" | "weak" | "schedule" | "estimated";
  /** Human-readable summary */
  summary: string;
  /** Inferred future time windows for overlap detection (next 14 days) */
  inferredWindows: Array<{ start: Date; end: Date }>;
  /** Normalized frequency per day-of-week [0..6], 0–1 scale */
  dayFrequency: number[];
  /** Normalized frequency per active hour [0..23], 0–1 scale */
  hourDistribution: number[];
  /** Stddev of start hours — low means very consistent, high means unpredictable */
  consistency: number;
  /** Number of sessions analyzed */
  sampleSize: number;
  /**
   * Per-day-of-week stream pattern. One entry per dow with at least one
   * historical stream. confidence === "high" means N >= 3 streams,
   * "low" means 1-2 streams. Days with zero streams are omitted.
   */
  perDay: Array<{
    dow: number;             // 0=Sun..6=Sat
    startHour: number;       // 0-23, in the timezone passed to analyzePatterns
    durationHours: number;
    confidence: "high" | "low";
  }>;
}

export function analyzePatterns(
  friendId: number,
  displayName: string,
  sessions: StreamSession[],
  scheduleHints: ScheduleHint[] = [],
  timezone: string = "UTC"
): StreamingPattern {
  if (sessions.length >= 3) {
    return analyzeFromHistory(friendId, displayName, sessions, scheduleHints, timezone);
  }
  if (scheduleHints.length > 0) {
    return analyzeFromSchedule(friendId, displayName, scheduleHints, sessions, timezone);
  }
  if (sessions.length > 0) {
    return analyzeFromHistory(friendId, displayName, sessions, scheduleHints, timezone);
  }
  return estimatedPattern(friendId, displayName);
}

function analyzeFromHistory(
  friendId: number,
  displayName: string,
  sessions: StreamSession[],
  scheduleHints: ScheduleHint[],
  timezone: string
): StreamingPattern {
  const dayCounts = new Array(7).fill(0);
  const hourCounts = new Array(HOURS_PER_DAY).fill(0);
  const startHours: number[] = [];
  const gameCounts: Record<string, number> = {};
  let totalSec = 0;

  for (const s of sessions) {
    const weight = recencyWeight(s.startTime);
    const { dayIndex, hour } = partsInTz(s.startTime, timezone);
    dayCounts[dayIndex] += weight;
    hourCounts[hour] += weight;
    startHours.push(hour);
    if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + 1;
    totalSec += s.durationSec;
  }

  for (const h of scheduleHints) {
    const weight = h.isRecurring ? 0.9 : 0.65;
    const { dayIndex, hour } = partsInTz(h.startTime, timezone);
    dayCounts[dayIndex] += weight;
    hourCounts[hour] += weight;
  }

  const smoothedHourCounts = smoothCircular(hourCounts);
  const maxDay = Math.max(...dayCounts) || 1;
  const maxHour = Math.max(...smoothedHourCounts) || 1;
  const dayFrequency = dayCounts.map((c) => c / maxDay);
  const hourDistribution = smoothedHourCounts.map((c) => c / maxHour);

  const sortedDays = dayCounts
    .map((count, i) => ({ day: DAYS[i], count }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((d) => d.day);

  startHours.sort((a, b) => a - b);
  const medianHour = startHours[Math.floor(startHours.length / 2)];
  const earliest = Math.min(...startHours);
  const latest = Math.max(...startHours);

  const consistency = circularStdDev(startHours);

  const avgDurationHours =
    Math.round((totalSec / sessions.length / 3600) * 10) / 10 || DEFAULT_DURATION_HOURS;

  const topGames = Object.entries(gameCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([g]) => g);

  const n = sessions.length;
  const confidence: StreamingPattern["confidence"] =
    n >= 20 ? "strong" : n >= 10 ? "moderate" : "weak";

  const daysStr = sortedDays.slice(0, 3).join(", ") || "weekends";
  const gamesStr = topGames.slice(0, 3).join(", ") || "various games";
  const summary =
    `${displayName} typically streams on ${daysStr} around ${formatHour(medianHour)} ${timezone} ` +
    `for ~${avgDurationHours}h. Most played: ${gamesStr}. (${n} streams analyzed)`;

  const perDay = computePerDay(sessions, sortedDays.slice(0, 3), timezone);

  return {
    friendId,
    displayName,
    typicalDays: sortedDays,
    startHours: { earliest, latest, median: medianHour },
    avgDurationHours,
    topGames,
    confidence,
    summary,
    inferredWindows: inferFutureWindows(sortedDays, medianHour, avgDurationHours),
    dayFrequency,
    hourDistribution,
    consistency,
    sampleSize: n,
    perDay,
  };
}

function analyzeFromSchedule(
  friendId: number,
  displayName: string,
  hints: ScheduleHint[],
  sessions: StreamSession[],
  timezone: string
): StreamingPattern {
  const dayCounts = new Array(7).fill(0);
  const hourCounts = new Array(HOURS_PER_DAY).fill(0);
  const gameCounts: Record<string, number> = {};
  const durations: number[] = [];
  const hours: number[] = [];

  for (const h of hints) {
    const weight = h.isRecurring ? 2 : 1.2;
    const { dayIndex, hour } = partsInTz(h.startTime, timezone);
    dayCounts[dayIndex] += weight;
    hourCounts[hour] += weight;
    hours.push(hour);
    if (h.gameName) gameCounts[h.gameName] = (gameCounts[h.gameName] ?? 0) + weight;
    const dur = (h.endTime.getTime() - h.startTime.getTime()) / 3600000;
    if (dur > 0) durations.push(dur);
  }
  for (const s of sessions) {
    if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + recencyWeight(s.startTime) * 0.5;
  }

  const smoothedHourCounts = smoothCircular(hourCounts);
  const maxDay = Math.max(...dayCounts) || 1;
  const maxHour = Math.max(...smoothedHourCounts) || 1;
  const dayFrequency = dayCounts.map((c) => c / maxDay);
  const hourDistribution = smoothedHourCounts.map((c) => c / maxHour);

  const sortedDays = dayCounts
    .map((count, i) => ({ day: DAYS[i], count }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((d) => d.day);

  hours.sort((a, b) => a - b);
  const medianHour = hours[Math.floor(hours.length / 2)] ?? 20;
  const avgDurationHours =
    durations.length > 0
      ? Math.round((durations.reduce((a, b) => a + b) / durations.length) * 10) / 10
      : DEFAULT_DURATION_HOURS;

  const topGames = Object.entries(gameCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([g]) => g);

  const daysStr = sortedDays.slice(0, 3).join(", ") || "weekends";
  const gamesStr = topGames.slice(0, 3).join(", ") || "various games";
  const summary =
    `${displayName} has a posted schedule: ${daysStr} around ${formatHour(medianHour)} ${timezone} ` +
    `for ~${avgDurationHours}h. Games: ${gamesStr}. (from Twitch schedule)`;

  // Treat each schedule hint as one "session" for perDay purposes. All
  // schedule-derived entries are low-confidence by definition.
  const synthetic: StreamSession[] = hints.map((h) => ({
    startTime: h.startTime,
    endTime: h.endTime,
    gameName: h.gameName,
    durationSec: Math.max(3600, (h.endTime.getTime() - h.startTime.getTime()) / 1000),
  }));
  const perDay = computePerDay(synthetic, sortedDays.slice(0, 3), timezone);

  return {
    friendId,
    displayName,
    typicalDays: sortedDays,
    startHours: { earliest: Math.min(...hours), latest: Math.max(...hours), median: medianHour },
    avgDurationHours,
    topGames,
    confidence: "schedule",
    summary,
    inferredWindows: inferFutureWindows(sortedDays, medianHour, avgDurationHours),
    dayFrequency,
    hourDistribution,
    consistency: circularStdDev(hours),
    sampleSize: hints.length,
    perDay,
  };
}

function estimatedPattern(friendId: number, displayName: string): StreamingPattern {
  const dayFrequency = [0.4, 0.28, 0.28, 0.32, 0.45, 0.75, 0.82];
  const hourDistribution = new Array(HOURS_PER_DAY).fill(0.08);
  hourDistribution[17] = 0.35;
  hourDistribution[18] = 0.55;
  hourDistribution[19] = 0.78;
  hourDistribution[20] = 1.0;
  hourDistribution[21] = 0.92;
  hourDistribution[22] = 0.72;
  hourDistribution[23] = 0.45;

  return {
    friendId,
    displayName,
    typicalDays: ["Saturday", "Friday", "Sunday"],
    startHours: { earliest: 18, latest: 23, median: 20 },
    avgDurationHours: DEFAULT_DURATION_HOURS,
    topGames: [],
    confidence: "estimated",
    summary: `${displayName}: no stream history yet. Using a broad evening/weekend fallback until more data is collected.`,
    inferredWindows: inferFutureWindows(["Saturday", "Friday", "Sunday"], 20, DEFAULT_DURATION_HOURS),
    dayFrequency,
    hourDistribution,
    consistency: 4,
    sampleSize: 0,
    perDay: [],
  };
}

export function formatHour(hour: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}${ampm}`;
}

function inferFutureWindows(
  topDays: string[],
  startHour: number,
  durationHours: number
): Array<{ start: Date; end: Date }> {
  return inferWindowsForRange(topDays, startHour, durationHours, new Date(), new Date(Date.now() + 14 * 86400000));
}

function recencyWeight(date: Date): number {
  const ageMs = Math.max(0, Date.now() - date.getTime());
  const ageDays = ageMs / 86400000;
  return 0.35 + 0.65 * Math.exp(-ageDays / 45);
}


function smoothCircular(values: number[]): number[] {
  return values.map((_, index) => {
    const prev = values[(index - 1 + values.length) % values.length];
    const curr = values[index];
    const next = values[(index + 1) % values.length];
    return prev * 0.2 + curr * 0.6 + next * 0.2;
  });
}

function circularStdDev(hours: number[]): number {
  if (hours.length <= 1) return 0;

  const radians = hours.map((hour) => (hour / HOURS_PER_DAY) * Math.PI * 2);
  const meanSin = radians.reduce((sum, value) => sum + Math.sin(value), 0) / radians.length;
  const meanCos = radians.reduce((sum, value) => sum + Math.cos(value), 0) / radians.length;
  const resultant = Math.sqrt(meanSin * meanSin + meanCos * meanCos);

  if (resultant <= 0) return HOURS_PER_DAY / 2;

  return Math.sqrt(-2 * Math.log(resultant)) * (HOURS_PER_DAY / (2 * Math.PI));
}

export function inferWindowsForRange(
  topDays: string[],
  startHour: number,
  durationHours: number,
  from: Date,
  to: Date
): Array<{ start: Date; end: Date }> {
  if (topDays.length === 0) return [];

  const windows: Array<{ start: Date; end: Date }> = [];
  const topDayIndices = new Set(topDays.slice(0, 4).map((d) => DAYS.indexOf(d)));

  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  while (cursor <= to) {
    if (topDayIndices.has(cursor.getUTCDay())) {
      const start = new Date(cursor);
      start.setUTCHours(startHour, 0, 0, 0);
      const end = new Date(start.getTime() + durationHours * 3600 * 1000);
      windows.push({ start, end });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return windows;
}
