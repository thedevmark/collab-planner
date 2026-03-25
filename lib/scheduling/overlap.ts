import type { StreamingPattern } from "./patterns";

export interface TimeSlot {
  start: Date;
  end: Date;
  participantId: string;
  participantName: string;
}

export interface OverlapWindow {
  start: Date;
  end: Date;
  participants: string[];
}

/** A scored candidate collab window derived from pattern analysis */
export interface ScoredSlot {
  /** Start of 1-hour window (UTC) */
  start: Date;
  /** End of 1-hour window (UTC) */
  end: Date;
  /** Sum of (dayFrequency × hourDistribution) across all friends */
  combinedScore: number;
  /** Per-friend probability breakdown */
  friendScores: Array<{ friendId: number; displayName: string; score: number }>;
}

const MIN_DURATION_MS = 60 * 60 * 1000; // 1 hour minimum

/**
 * Score-based overlap detection using streaming pattern probability distributions.
 * For each 1-hour block in the next 14 days (UTC), computes a combined score
 * by summing dayFrequency[day] × hourDistribution[hour] across all friends.
 * Returns the top N slots sorted by score descending.
 *
 * All times are in UTC. Callers must convert to user's timezone for display.
 */
export function rankCollabSlots(
  patterns: StreamingPattern[],
  topN = 5,
  from: Date = new Date(),
  to: Date = new Date(Date.now() + 14 * 86400000)
): ScoredSlot[] {
  if (patterns.length === 0) return [];

  const scored: ScoredSlot[] = [];

  // Walk every hour in [from, to)
  const cursor = new Date(from);
  cursor.setUTCMinutes(0, 0, 0);

  while (cursor < to) {
    const day = cursor.getUTCDay();
    const hour = cursor.getUTCHours();

    const friendScores = patterns.map((p) => ({
      friendId: p.friendId,
      displayName: p.displayName,
      score: p.dayFrequency[day] * p.hourDistribution[hour],
    }));

    const combinedScore = friendScores.reduce((sum, f) => sum + f.score, 0);

    // Only include slots where every friend has at least a minimal probability
    const allEngaged = friendScores.every((f) => f.score > 0);

    if (allEngaged && combinedScore > 0) {
      scored.push({
        start: new Date(cursor),
        end: new Date(cursor.getTime() + MIN_DURATION_MS),
        combinedScore,
        friendScores,
      });
    }

    cursor.setUTCHours(cursor.getUTCHours() + 1);
  }

  // Sort by combinedScore descending, take top N
  scored.sort((a, b) => b.combinedScore - a.combinedScore);
  return scored.slice(0, topN);
}

/**
 * Merge adjacent or overlapping hour-blocks with the same top slot,
 * useful for grouping consecutive high-score windows into a single suggestion.
 */
export function mergeAdjacentSlots(slots: ScoredSlot[]): ScoredSlot[] {
  if (slots.length === 0) return [];

  // Sort by start time
  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: ScoredSlot[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr.start.getTime() === last.end.getTime()) {
      // Extend the window, keep the higher score
      last.end = curr.end;
      last.combinedScore = Math.max(last.combinedScore, curr.combinedScore);
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}

// ── Legacy binary overlap detection (kept for calendar schedule overlay) ──

export function findOverlapWindows(
  slots: TimeSlot[],
  minParticipants = 2
): OverlapWindow[] {
  if (slots.length === 0) return [];

  // Group slots by participant
  const byParticipant = new Map<string, TimeSlot[]>();
  for (const slot of slots) {
    const key = `${slot.participantId}:${slot.participantName}`;
    if (!byParticipant.has(key)) byParticipant.set(key, []);
    byParticipant.get(key)!.push(slot);
  }

  const participants = Array.from(byParticipant.entries());
  const overlaps: OverlapWindow[] = [];

  // Get all unique time boundaries
  const boundaries = new Set<number>();
  for (const slot of slots) {
    boundaries.add(slot.start.getTime());
    boundaries.add(slot.end.getTime());
  }
  const sorted = Array.from(boundaries).sort((a, b) => a - b);

  // For each time interval between boundaries, check who is free
  for (let i = 0; i < sorted.length - 1; i++) {
    const windowStart = sorted[i];
    const windowEnd = sorted[i + 1];

    if (windowEnd - windowStart < MIN_DURATION_MS) continue;

    const availableParticipants: string[] = [];
    for (const [, pSlots] of participants) {
      const isFree = pSlots.some(
        (s) => s.start.getTime() <= windowStart && s.end.getTime() >= windowEnd
      );
      if (isFree) availableParticipants.push(pSlots[0].participantName);
    }

    if (availableParticipants.length >= minParticipants) {
      // Merge with previous window if same participants
      const last = overlaps[overlaps.length - 1];
      if (
        last &&
        last.end.getTime() === windowStart &&
        JSON.stringify(last.participants.sort()) ===
          JSON.stringify(availableParticipants.sort())
      ) {
        last.end = new Date(windowEnd);
      } else {
        overlaps.push({
          start: new Date(windowStart),
          end: new Date(windowEnd),
          participants: availableParticipants,
        });
      }
    }
  }

  return overlaps;
}

// Convert schedule segments to free-time slots
export function scheduleSegmentsToSlots(
  segments: Array<{
    startTime: Date;
    endTime: Date;
    participantId: string;
    participantName: string;
  }>
): TimeSlot[] {
  return segments.map((s) => ({
    start: s.startTime,
    end: s.endTime,
    participantId: s.participantId,
    participantName: s.participantName,
  }));
}
