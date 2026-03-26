"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { addDays, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, CalendarPlus, Loader2, RefreshCw, Users } from "lucide-react";
import { useReminderPolling } from "@/hooks/useReminders";
import OnboardingModal from "@/components/onboarding/OnboardingModal";

const fetcher = <T,>(url: string): Promise<T> => fetch(url).then((r) => r.json());

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "secondary"> = {
  planned: "secondary",
  confirmed: "success",
};

type EventParticipant = {
  id: number;
  friend: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isMe: boolean;
  };
};

type EventSummary = {
  id: number;
  title: string;
  status: string;
  startTime: string;
  endTime: string;
  gameName: string | null;
  participants: EventParticipant[];
};

type FriendScheduleSegment = {
  startTime: string;
  gameName: string | null;
};

type FriendHistoryEntry = {
  startTime: string;
};

type FriendSummary = {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  isMe: boolean;
  channelColor: string | null;
  scheduleSegments?: FriendScheduleSegment[];
  streamHistory?: FriendHistoryEntry[];
};

type LiveFriend = {
  id: number;
  gameName?: string | null;
  viewerCount?: number | null;
};

type LiveData = {
  live: LiveFriend[];
};

type ProfileSummary = {
  hasCompletedOnboarding?: boolean;
  displayName?: string;
  avatarUrl?: string;
  friendCount?: number;
};

type SignalPerson = {
  friend: FriendSummary;
  signal: "live" | "scheduled" | "pattern";
  liveInfo?: LiveFriend;
  nextSegment?: FriendScheduleSegment;
};

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const IN_7_DAYS = addDays(TODAY, 7);
const EVENTS_KEY = `/api/events?from=${TODAY.toISOString()}&to=${IN_7_DAYS.toISOString()}`;

export default function HomePage() {
  const now = new Date();

  const { data: events = [], mutate: mutateEvents } = useSWR<EventSummary[]>(EVENTS_KEY, fetcher);
  const { data: friends = [], mutate: mutateFriends } = useSWR<FriendSummary[]>("/api/friends", fetcher);
  const { data: liveData, mutate: mutateLive } = useSWR<LiveData>("/api/twitch/live", fetcher, {
    refreshInterval: 60000,
  });
  const { data: profile, mutate: mutateProfile } = useSWR<ProfileSummary>("/api/profile/onboarding", fetcher);
  const [refreshing, setRefreshing] = useState(false);

  useReminderPolling(true);

  const nonMeFriends = friends.filter((friend) => !friend.isMe);
  const streamingNow = liveData?.live ?? [];
  const liveIds = new Set(streamingNow.map((friend) => friend.id));

  const livePeople: SignalPerson[] = nonMeFriends
    .filter((friend) => liveIds.has(friend.id))
    .map((friend) => ({
      friend,
      signal: "live",
      liveInfo: streamingNow.find((liveFriend) => liveFriend.id === friend.id),
    }));

  const scheduledPeople: SignalPerson[] = [];
  for (const friend of nonMeFriends) {
    if (liveIds.has(friend.id)) continue;

    const nextSegment = friend.scheduleSegments?.find((segment) => {
      const start = new Date(segment.startTime);
      return start > now && start <= addDays(now, 1);
    });

    if (nextSegment) {
      scheduledPeople.push({
        friend,
        signal: "scheduled",
        nextSegment,
      });
    }
  }

  const patternPeople: SignalPerson[] = nonMeFriends
    .filter((friend) => !liveIds.has(friend.id))
    .filter((friend) => !scheduledPeople.some((item) => item.friend.id === friend.id))
    .filter((friend) => {
      if ((friend.streamHistory?.length ?? 0) < 3) return false;

      const dayCounts: Record<number, number> = {};
      for (const stream of friend.streamHistory ?? []) {
        const day = new Date(stream.startTime).getUTCDay();
        dayCounts[day] = (dayCounts[day] ?? 0) + 1;
      }

      const topDays = Object.entries(dayCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([day]) => parseInt(day, 10));

      return topDays.includes(now.getUTCDay());
    })
    .map((friend) => ({
      friend,
      signal: "pattern" as const,
    }));

  const peopleWithSignals = [...livePeople, ...scheduledPeople, ...patternPeople].slice(0, 6);

  async function refreshSchedules() {
    setRefreshing(true);
    await fetch("/api/twitch/refresh-schedules", { method: "POST" });
    await Promise.all([mutateEvents(), mutateFriends(), mutateLive()]);
    setRefreshing(false);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {profile?.hasCompletedOnboarding === false && (
        <OnboardingModal
          displayName={profile.displayName ?? ""}
          avatarUrl={profile.avatarUrl ?? ""}
          friendCount={profile.friendCount ?? 0}
          onComplete={async () => {
            await Promise.all([mutateProfile(), mutateFriends(), mutateLive()]);
          }}
        />
      )}

      <Card>
        <CardContent className="flex flex-col gap-5 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">Home</h1>
              <p className="text-muted-foreground">{format(now, "EEEE, MMMM d, yyyy")}</p>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Pick your people, find a workable window, and lock a session. Smart scheduling stays in support.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border px-2.5 py-1">{nonMeFriends.length} people</span>
              <span className="rounded-full border px-2.5 py-1">{events.length} upcoming sessions</span>
              <span className="rounded-full border px-2.5 py-1">{streamingNow.length} live now</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={refreshSchedules} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Link href="/friends">
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4" />
                People
              </Button>
            </Link>
            <Link href="/events/new">
              <Button size="sm">
                <CalendarPlus className="h-4 w-4" />
                New Session
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Continue Planning</CardTitle>
              <Link href="/events">
                <Button variant="ghost" size="sm">History</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                <CalendarPlus className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p className="text-sm font-medium">No upcoming sessions</p>
                <p className="mt-1 text-xs">Start a new one or use the calendar helper if you want a date first.</p>
                <div className="mt-4 flex justify-center gap-2">
                  <Link href="/events/new">
                    <Button size="sm">New Session</Button>
                  </Link>
                  <Link href="/calendar">
                    <Button size="sm" variant="outline">
                      <Calendar className="h-4 w-4" />
                      Calendar Helper
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              events.slice(0, 5).map((event) => (
                <Link key={event.id} href={`/events/${event.id}`}>
                  <div className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{event.title}</p>
                        <Badge variant={STATUS_COLORS[event.status] ?? "secondary"} className="text-xs shrink-0">
                          {event.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(event.startTime), "EEE, MMM d 'at' h:mm a")}
                      </p>
                      {event.gameName && (
                        <p className="text-xs text-muted-foreground">{event.gameName}</p>
                      )}
                    </div>
                    <div className="flex -space-x-1">
                      {event.participants
                        ?.filter((participant) => !participant.friend.isMe)
                        .slice(0, 3)
                        .map((participant) => (
                          <Avatar key={participant.id} className="h-7 w-7 border-2 border-background">
                            <AvatarImage src={participant.friend.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-[10px]">
                              {participant.friend.displayName[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">People With Signals Today</CardTitle>
                <Link href="/friends">
                  <Button variant="ghost" size="sm">View people</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {peopleWithSignals.length === 0 ? (
                <div className="rounded-lg border border-dashed p-5 text-center text-muted-foreground">
                  <Users className="mx-auto mb-2 h-7 w-7 opacity-40" />
                  <p className="text-sm">No live or likely-streaming people right now</p>
                </div>
              ) : (
                peopleWithSignals.map(({ friend, signal, liveInfo, nextSegment }) => (
                  <div key={friend.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={friend.avatarUrl ?? undefined} />
                      <AvatarFallback>{friend.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{friend.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {signal === "live"
                          ? `${liveInfo?.gameName || "Live now"}${liveInfo?.viewerCount ? ` · ${liveInfo.viewerCount.toLocaleString()} viewers` : ""}`
                          : signal === "scheduled"
                            ? `${format(new Date(nextSegment!.startTime), "h:mm a")}${nextSegment?.gameName ? ` · ${nextSegment.gameName}` : ""}`
                            : "Usually streams today"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={signal === "live" ? "success" : "secondary"} className="text-xs">
                        {signal === "live" ? "Live" : signal === "scheduled" ? "Scheduled" : "Pattern"}
                      </Badge>
                      <Link href={`/events/new?friendId=${friend.id}`}>
                        <Button size="sm" variant="outline">Start</Button>
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Need A Date First?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Use the calendar helper when you want to start from a day or a friend list, then jump back into session setup.
              </p>
              <Link href="/calendar">
                <Button variant="outline" className="w-full justify-center">
                  <Calendar className="h-4 w-4" />
                  Open Calendar Helper
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
