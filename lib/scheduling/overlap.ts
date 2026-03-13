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

const MIN_DURATION_MS = 60 * 60 * 1000; // 1 hour minimum

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
// Twitch schedules represent when streamers ARE streaming, so we invert these
// to get free time. For this tool's purpose, we use the schedule segments directly
// as "available for collab" windows since they already stream at those times.
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
