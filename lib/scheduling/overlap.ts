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
  /** Aggregate overlap score across all friends */
  combinedScore: number;
  /** Human-readable confidence tier for the suggestion */
  confidence: "high" | "medium" | "low";
  /** Per-friend probability breakdown */
  friendScores: Array<{ friendId: number; displayName: string; score: number }>;
}

const MIN_DURATION_MS = 60 * 60 * 1000; // 1 hour minimum

/**
 * Score-based overlap detection using recency-weighted, active-hour pattern
 * distributions. The scorer prefers slots where the whole group has plausible
 * overlap, not just identical start hours.
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

  const hourlyCandidates: ScoredSlot[] = [];

  // Walk every hour in [from, to)
  const cursor = new Date(from);
  cursor.setUTCMinutes(0, 0, 0);

  while (cursor < to) {
    const day = cursor.getUTCDay();
    const hour = cursor.getUTCHours();

    const friendScores = patterns.map((pattern) => {
      const baseScore = pattern.dayFrequency[day] * pattern.hourDistribution[hour];
      return {
        friendId: pattern.friendId,
        displayName: pattern.displayName,
        score: clampScore(baseScore * reliabilityWeight(pattern)),
      };
    });

    const minFriendScore = Math.min(...friendScores.map((friend) => friend.score));
    const averageFriendScore =
      friendScores.reduce((sum, friend) => sum + friend.score, 0) / friendScores.length;
    const harmony = averageFriendScore > 0 ? minFriendScore / averageFriendScore : 0;
    const combinedScore = averageFriendScore * (0.7 + 0.3 * harmony);

    if (isViableSlot(patterns.length, averageFriendScore, minFriendScore)) {
      hourlyCandidates.push({
        start: new Date(cursor),
        end: new Date(cursor.getTime() + MIN_DURATION_MS),
        combinedScore,
        confidence: scoreToConfidence(averageFriendScore, minFriendScore),
        friendScores,
      });
    }

    cursor.setUTCHours(cursor.getUTCHours() + 1);
  }

  const merged = mergeAdjacentSlots(hourlyCandidates);
  merged.sort((a, b) => b.combinedScore - a.combinedScore || a.start.getTime() - b.start.getTime());
  return merged.slice(0, topN);
}

/**
 * Merge adjacent or overlapping hour-blocks with the same top slot,
 * useful for grouping consecutive high-score windows into a single suggestion.
 */
export function mergeAdjacentSlots(slots: ScoredSlot[]): ScoredSlot[] {
  if (slots.length === 0) return [];

  // Sort by start time
  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Array<ScoredSlot & { slotCount: number }> = [{ ...sorted[0], slotCount: 1 }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr.start.getTime() === last.end.getTime()) {
      last.end = curr.end;
      last.combinedScore =
        (last.combinedScore * last.slotCount + curr.combinedScore) / (last.slotCount + 1);
      last.friendScores = last.friendScores.map((friendScore, index) => ({
        ...friendScore,
        score:
          (friendScore.score * last.slotCount + curr.friendScores[index].score) /
          (last.slotCount + 1),
      }));
      last.slotCount += 1;
      last.confidence = strongestConfidence(last.confidence, curr.confidence);
    } else {
      merged.push({ ...curr, slotCount: 1 });
    }
  }

  return merged.map(({ slotCount, ...slot }) => {
    void slotCount;
    return slot;
  });
}

function reliabilityWeight(pattern: StreamingPattern): number {
  const confidenceWeight: Record<StreamingPattern["confidence"], number> = {
    strong: 1,
    moderate: 0.92,
    weak: 0.84,
    schedule: 0.9,
    estimated: 0.7,
  };

  const consistencyPenalty = Math.min(pattern.consistency / 8, 0.3);
  return confidenceWeight[pattern.confidence] * (1 - consistencyPenalty);
}

function isViableSlot(groupSize: number, averageFriendScore: number, minFriendScore: number): boolean {
  const minThreshold = groupSize >= 4 ? 0.08 : 0.1;
  const avgThreshold = groupSize >= 4 ? 0.18 : 0.2;
  return averageFriendScore >= avgThreshold && minFriendScore >= minThreshold;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, score));
}

function scoreToConfidence(
  averageFriendScore: number,
  minFriendScore: number
): "high" | "medium" | "low" {
  if (averageFriendScore >= 0.48 && minFriendScore >= 0.3) return "high";
  if (averageFriendScore >= 0.3 && minFriendScore >= 0.16) return "medium";
  return "low";
}

function strongestConfidence(
  left: "high" | "medium" | "low",
  right: "high" | "medium" | "low"
): "high" | "medium" | "low" {
  const order = { high: 3, medium: 2, low: 1 };
  return order[left] >= order[right] ? left : right;
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
