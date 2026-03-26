import {
  analyzePatterns,
  type ScheduleHint,
  type StreamSession,
  type StreamingPattern,
} from "./patterns";
import { mergeAdjacentSlots, scoreCollabHours, type ScoredSlot } from "./overlap";

export interface PlannerFriendLike {
  id: number;
  displayName: string;
  isMe?: boolean;
  streamHistory?: Array<{
    startTime: string | Date;
    endTime: string | Date;
    gameName?: string;
    durationSec?: number;
  }>;
  scheduleSegments?: Array<{
    startTime: string | Date;
    endTime: string | Date;
    title?: string;
    gameName?: string;
    isRecurring?: boolean;
  }>;
}

export function buildPlannerPatterns(friends: PlannerFriendLike[]): StreamingPattern[] {
  return friends.map((friend) => {
    const sessions: StreamSession[] = (friend.streamHistory ?? []).map((session) => ({
      startTime: new Date(session.startTime),
      endTime: new Date(session.endTime),
      gameName: session.gameName ?? "",
      durationSec:
        session.durationSec ??
        Math.max(0, new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000,
    }));

    const scheduleHints: ScheduleHint[] = (friend.scheduleSegments ?? []).map((segment) => ({
      startTime: new Date(segment.startTime),
      endTime: new Date(segment.endTime),
      gameName: segment.gameName ?? segment.title ?? "",
      isRecurring: segment.isRecurring ?? false,
    }));

    return analyzePatterns(friend.id, friend.isMe ? "You" : friend.displayName, sessions, scheduleHints);
  });
}

export function getPlannerHourlySlots(
  friends: PlannerFriendLike[],
  from: Date,
  to: Date
): ScoredSlot[] {
  if (friends.length === 0) return [];
  return scoreCollabHours(buildPlannerPatterns(friends), from, to);
}

export function getPlannerTopSlots(
  friends: PlannerFriendLike[],
  from: Date,
  to: Date,
  topN = 5
): ScoredSlot[] {
  const viable = getPlannerHourlySlots(friends, from, to).filter((slot) => slot.viable);
  const merged = mergeAdjacentSlots(viable);
  merged.sort((left, right) => right.combinedScore - left.combinedScore || left.start.getTime() - right.start.getTime());
  return merged.slice(0, topN);
}
