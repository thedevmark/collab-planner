export type EventStatus = "planned" | "confirmed" | "completed" | "canceled";
export type InviteStatus = "pending" | "accepted" | "declined";
export type MessageType = "invite" | "reminder";

export interface ApiError {
  error: string;
  details?: string;
}

export interface FriendWithSchedule {
  id: number;
  twitchId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  notes: string;
  isActive: boolean;
  scheduleSegments: ScheduleSegmentData[];
}

export interface ScheduleSegmentData {
  id: number;
  segmentId: string;
  title: string;
  startTime: string;
  endTime: string;
  gameName: string;
  gameId: string;
  isRecurring: boolean;
  fetchedAt: string;
}

export interface EventWithParticipants {
  id: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  gameName: string;
  gameId: string;
  status: EventStatus;
  googleCalendarEventId: string;
  googleCalendarLink: string;
  participants: ParticipantData[];
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantData {
  id: number;
  friendId: number;
  inviteStatus: InviteStatus;
  friend: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string;
  };
}

export interface TimeSuggestion {
  rank: number;
  start: string;
  end: string;
  participants: string[];
  reason: string;
}

export interface GameSuggestion {
  name: string;
  reason: string;
  isTrending: boolean;
}
