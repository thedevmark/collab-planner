const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  /** Typical start hour in UTC */
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
  /** Normalized frequency per start-hour [0..23], 0–1 scale */
  hourDistribution: number[];
  /** Stddev of start hours — low means very consistent, high means unpredictable */
  consistency: number;
  /** Number of sessions analyzed */
  sampleSize: number;
}

export function analyzePatterns(
  friendId: number,
  displayName: string,
  sessions: StreamSession[],
  scheduleHints: ScheduleHint[] = []
): StreamingPattern {
  if (sessions.length >= 3) {
    return analyzeFromHistory(friendId, displayName, sessions, scheduleHints);
  }
  if (scheduleHints.length > 0) {
    return analyzeFromSchedule(friendId, displayName, scheduleHints, sessions);
  }
  if (sessions.length > 0) {
    return analyzeFromHistory(friendId, displayName, sessions, scheduleHints);
  }
  return estimatedPattern(friendId, displayName);
}

function analyzeFromHistory(
  friendId: number,
  displayName: string,
  sessions: StreamSession[],
  scheduleHints: ScheduleHint[]
): StreamingPattern {
  const dayCounts = new Array(7).fill(0);
  const hourCounts = new Array(24).fill(0);
  const hours: number[] = [];
  const gameCounts: Record<string, number> = {};
  let totalSec = 0;

  for (const s of sessions) {
    const day = s.startTime.getUTCDay();
    const hour = s.startTime.getUTCHours();
    dayCounts[day]++;
    hourCounts[hour]++;
    hours.push(hour);
    if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + 1;
    totalSec += s.durationSec;
  }

  // Blend in schedule hints at half weight
  for (const h of scheduleHints) {
    dayCounts[h.startTime.getUTCDay()] += 0.5;
    hourCounts[h.startTime.getUTCHours()] += 0.5;
  }

  const maxDay = Math.max(...dayCounts) || 1;
  const maxHour = Math.max(...hourCounts) || 1;
  const dayFrequency = dayCounts.map((c) => c / maxDay);
  const hourDistribution = hourCounts.map((c) => c / maxHour);

  const sortedDays = dayCounts
    .map((count, i) => ({ day: DAYS[i], count }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((d) => d.day);

  hours.sort((a, b) => a - b);
  const medianHour = hours[Math.floor(hours.length / 2)];
  const earliest = Math.min(...hours);
  const latest = Math.max(...hours);

  // Consistency: stddev of start hours (circular-aware for midnight wrap)
  const meanHour = hours.reduce((a, b) => a + b, 0) / hours.length;
  const variance = hours.reduce((sum, h) => sum + Math.pow(h - meanHour, 2), 0) / hours.length;
  const consistency = Math.sqrt(variance);

  const avgDurationHours = Math.round((totalSec / sessions.length / 3600) * 10) / 10 || 3;

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
    `${displayName} typically streams on ${daysStr} around ${formatHour(medianHour)} UTC ` +
    `for ~${avgDurationHours}h. Most played: ${gamesStr}. (${n} streams analyzed)`;

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
  };
}

function analyzeFromSchedule(
  friendId: number,
  displayName: string,
  hints: ScheduleHint[],
  sessions: StreamSession[]
): StreamingPattern {
  const dayCounts = new Array(7).fill(0);
  const hourCounts = new Array(24).fill(0);
  const gameCounts: Record<string, number> = {};
  const durations: number[] = [];

  for (const h of hints) {
    const weight = h.isRecurring ? 2 : 1;
    dayCounts[h.startTime.getUTCDay()] += weight;
    hourCounts[h.startTime.getUTCHours()] += weight;
    if (h.gameName) gameCounts[h.gameName] = (gameCounts[h.gameName] ?? 0) + 1;
    const dur = (h.endTime.getTime() - h.startTime.getTime()) / 3600000;
    if (dur > 0) durations.push(dur);
  }
  for (const s of sessions) {
    if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + 0.5;
  }

  const maxDay = Math.max(...dayCounts) || 1;
  const maxHour = Math.max(...hourCounts) || 1;
  const dayFrequency = dayCounts.map((c) => c / maxDay);
  const hourDistribution = hourCounts.map((c) => c / maxHour);

  const sortedDays = dayCounts
    .map((count, i) => ({ day: DAYS[i], count }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((d) => d.day);

  const hours = hints.map((h) => h.startTime.getUTCHours()).sort((a, b) => a - b);
  const medianHour = hours[Math.floor(hours.length / 2)] ?? 20;
  const avgDurationHours =
    durations.length > 0
      ? Math.round((durations.reduce((a, b) => a + b) / durations.length) * 10) / 10
      : 3;

  const topGames = Object.entries(gameCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([g]) => g);

  const daysStr = sortedDays.slice(0, 3).join(", ") || "weekends";
  const gamesStr = topGames.slice(0, 3).join(", ") || "various games";
  const summary =
    `${displayName} has a posted schedule: ${daysStr} around ${formatHour(medianHour)} UTC ` +
    `for ~${avgDurationHours}h. Games: ${gamesStr}. (from Twitch schedule)`;

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
    consistency: 0,
    sampleSize: hints.length,
  };
}

function estimatedPattern(friendId: number, displayName: string): StreamingPattern {
  const dayFrequency = [0.8, 0.2, 0.2, 0.2, 0.4, 0.9, 1.0]; // Fri/Sat/Sun weighted
  const hourDistribution = new Array(24).fill(0);
  hourDistribution[19] = 0.6;
  hourDistribution[20] = 1.0;
  hourDistribution[21] = 0.8;
  hourDistribution[22] = 0.5;

  return {
    friendId,
    displayName,
    typicalDays: ["Saturday", "Friday", "Sunday"],
    startHours: { earliest: 18, latest: 23, median: 20 },
    avgDurationHours: 3,
    topGames: [],
    confidence: "estimated",
    summary: `${displayName}: no stream history yet. Estimated as a typical evening streamer (Fri/Sat/Sun ~8PM UTC).`,
    inferredWindows: inferFutureWindows(["Saturday", "Friday", "Sunday"], 20, 3),
    dayFrequency,
    hourDistribution,
    consistency: 2,
    sampleSize: 0,
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
