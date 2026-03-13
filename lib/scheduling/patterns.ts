const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  /** How confident we are: "history" | "schedule" | "mixed" | "estimated" */
  confidence: "history" | "schedule" | "mixed" | "estimated";
  /** Human-readable summary for AI prompts — always populated */
  summary: string;
  /** Inferred future time windows for overlap detection (next 14 days) */
  inferredWindows: Array<{ start: Date; end: Date }>;
}

/**
 * Analyze streaming patterns from actual history + optional schedule hints.
 * Always returns a usable pattern — never a dead-end "no data" result.
 */
export function analyzePatterns(
  friendId: number,
  displayName: string,
  sessions: StreamSession[],
  scheduleHints: ScheduleHint[] = []
): StreamingPattern {
  // --- Use stream history if we have it ---
  if (sessions.length >= 3) {
    return analyzeFromHistory(friendId, displayName, sessions, scheduleHints);
  }

  // --- Fall back to schedule if we have it ---
  if (scheduleHints.length > 0) {
    return analyzeFromSchedule(friendId, displayName, scheduleHints, sessions);
  }

  // --- Sparse history (1-2 streams): use what we have + generic estimates ---
  if (sessions.length > 0) {
    return analyzeFromHistory(friendId, displayName, sessions, scheduleHints, true);
  }

  // --- Truly no data: return a generic "evening streamer" estimate ---
  return estimatedPattern(friendId, displayName);
}

function analyzeFromHistory(
  friendId: number,
  displayName: string,
  sessions: StreamSession[],
  scheduleHints: ScheduleHint[],
  sparse = false
): StreamingPattern {
  const dayCounts: Record<number, number> = {};
  const hours: number[] = [];
  const gameCounts: Record<string, number> = {};
  let totalSec = 0;

  for (const s of sessions) {
    const day = s.startTime.getDay();
    dayCounts[day] = (dayCounts[day] ?? 0) + 1;
    hours.push(s.startTime.getUTCHours());
    if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + 1;
    totalSec += s.durationSec;
  }

  // If schedule hints exist, boost the days they confirm
  for (const h of scheduleHints) {
    const day = h.startTime.getDay();
    dayCounts[day] = (dayCounts[day] ?? 0) + 0.5; // half-weight
  }

  const sortedDays = Object.entries(dayCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([d]) => DAYS[parseInt(d)]);

  hours.sort((a, b) => a - b);
  const medianHour = hours[Math.floor(hours.length / 2)];
  const earliest = Math.min(...hours);
  const latest = Math.max(...hours);

  const avgSec = totalSec / sessions.length;
  const avgDurationHours = Math.round((avgSec / 3600) * 10) / 10 || 3;

  const topGames = Object.entries(gameCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([g]) => g);

  const daysStr = sortedDays.slice(0, 3).join(", ") || "weekends";
  const gamesStr = topGames.slice(0, 3).join(", ") || "various games";
  const confidence = scheduleHints.length > 0 ? "mixed" : sparse ? "estimated" : "history";
  const dataNote = sparse
    ? `(limited data — ${sessions.length} stream${sessions.length > 1 ? "s" : ""} analyzed)`
    : `(${sessions.length} streams analyzed)`;

  const summary =
    `${displayName} typically streams on ${daysStr} around ${formatHour(medianHour)} UTC ` +
    `for ~${avgDurationHours}h. Most played: ${gamesStr}. ${dataNote}`;

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
  };
}

function analyzeFromSchedule(
  friendId: number,
  displayName: string,
  hints: ScheduleHint[],
  sessions: StreamSession[]
): StreamingPattern {
  const dayCounts: Record<number, number> = {};
  const hours: number[] = [];
  const gameCounts: Record<string, number> = {};
  const durations: number[] = [];

  for (const h of hints) {
    const day = h.startTime.getDay();
    dayCounts[day] = (dayCounts[day] ?? 0) + (h.isRecurring ? 2 : 1);
    hours.push(h.startTime.getUTCHours());
    if (h.gameName) gameCounts[h.gameName] = (gameCounts[h.gameName] ?? 0) + 1;
    const dur = (h.endTime.getTime() - h.startTime.getTime()) / 3600000;
    if (dur > 0) durations.push(dur);
  }

  // Supplement game list from any history we do have
  for (const s of sessions) {
    if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + 0.5;
  }

  const sortedDays = Object.entries(dayCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([d]) => DAYS[parseInt(d)]);

  hours.sort((a, b) => a - b);
  const medianHour = hours[Math.floor(hours.length / 2)] ?? 20;
  const earliest = Math.min(...hours);
  const latest = Math.max(...hours);
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
    `${displayName} has a posted schedule: streams on ${daysStr} around ${formatHour(medianHour)} UTC ` +
    `for ~${avgDurationHours}h. Games: ${gamesStr}. (from Twitch schedule)`;

  return {
    friendId,
    displayName,
    typicalDays: sortedDays,
    startHours: { earliest, latest, median: medianHour },
    avgDurationHours,
    topGames,
    confidence: "schedule",
    summary,
    inferredWindows: inferFutureWindows(sortedDays, medianHour, avgDurationHours),
  };
}

/** Fallback when we have no data at all — reasonable defaults for a typical streamer */
function estimatedPattern(friendId: number, displayName: string): StreamingPattern {
  // Default: evenings on weekends + one weekday, 3h sessions
  const typicalDays = ["Friday", "Saturday", "Sunday"];
  const medianHour = 20; // 8PM UTC

  const summary =
    `${displayName}: no stream history available yet. ` +
    `Estimated as a typical evening streamer (Fri/Sat/Sun ~8PM UTC, ~3h). ` +
    `Refresh their data or check back after they stream.`;

  return {
    friendId,
    displayName,
    typicalDays,
    startHours: { earliest: 18, latest: 23, median: medianHour },
    avgDurationHours: 3,
    topGames: [],
    confidence: "estimated",
    summary,
    inferredWindows: inferFutureWindows(typicalDays, medianHour, 3),
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
  cursor.setDate(cursor.getDate() + 1);

  while (cursor <= to) {
    if (topDayIndices.has(cursor.getDay())) {
      const start = new Date(cursor);
      start.setUTCHours(startHour, 0, 0, 0);
      const end = new Date(start.getTime() + durationHours * 3600 * 1000);
      windows.push({ start, end });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return windows;
}
