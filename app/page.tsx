"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { format, addDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarPlus, RefreshCw, MessageSquare, Users, Clock, Gamepad2, Loader2 } from "lucide-react";
import { useReminderPolling } from "@/hooks/useReminders";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "secondary"> = {
  planned: "secondary",
  confirmed: "success",
};

// Stable date strings (computed once at module load, not on every render)
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const IN_7_DAYS = addDays(TODAY, 7);
const EVENTS_KEY = `/api/events?from=${TODAY.toISOString()}&to=${IN_7_DAYS.toISOString()}`;

export default function Dashboard() {
  const now = new Date();

  const { data: events = [], mutate: mutateEvents } = useSWR(EVENTS_KEY, fetcher);
  const { data: friends = [], mutate: mutateFriends } = useSWR("/api/friends", fetcher);
  const { data: liveData, mutate: mutateLive } = useSWR("/api/twitch/live", fetcher, { refreshInterval: 60000 });
  const [refreshing, setRefreshing] = useState(false);

  useReminderPolling(true);

  const nonMeFriends = friends.filter((f: any) => !f.isMe);

  // Real-time live status from Twitch API (refreshes every 60s)
  const streamingNow: any[] = liveData?.live ?? [];
  const liveIds = new Set(streamingNow.map((f: any) => f.id));

  // Estimate who's likely streaming soon (scheduled or pattern-based), excluding live
  const streamingSoon = nonMeFriends.filter((f: any) => {
    if (liveIds.has(f.id)) return false;
    const hasScheduled = f.scheduleSegments?.some((s: any) => {
      const start = new Date(s.startTime);
      return start > now && start <= addDays(now, 1);
    });
    if (hasScheduled) return true;
    if (f.streamHistory?.length >= 3) {
      const dayCounts: Record<number, number> = {};
      for (const s of f.streamHistory) {
        const d = new Date(s.startTime).getUTCDay();
        dayCounts[d] = (dayCounts[d] ?? 0) + 1;
      }
      const topDays = Object.entries(dayCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 3)
        .map(([d]) => parseInt(d));
      return topDays.includes(now.getUTCDay());
    }
    return false;
  });

  async function refreshSchedules() {
    setRefreshing(true);
    await fetch("/api/twitch/refresh-schedules", { method: "POST" });
    await Promise.all([mutateEvents(), mutateFriends(), mutateLive()]);
    setRefreshing(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{format(now, "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshSchedules} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Link href="/events/new">
            <Button size="sm">
              <CalendarPlus className="h-4 w-4" />
              Plan Collab
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{nonMeFriends.length}</p>
                <p className="text-sm text-muted-foreground">Friends</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{events.length}</p>
                <p className="text-sm text-muted-foreground">Events (7 days)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Gamepad2 className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{streamingNow.length}</p>
                <p className="text-sm text-muted-foreground">Streaming Now</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Upcoming Events</CardTitle>
              <Link href="/calendar">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {events.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CalendarPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No upcoming events</p>
                <Link href="/events/new">
                  <Button variant="link" size="sm">Plan a collab</Button>
                </Link>
              </div>
            ) : (
              events.slice(0, 5).map((event: any) => (
                <Link key={event.id} href={`/events/${event.id}`}>
                  <div className="flex items-start gap-3 p-3 rounded-md hover:bg-accent transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{event.title}</p>
                        <Badge variant={STATUS_COLORS[event.status] ?? "secondary"} className="text-xs shrink-0">
                          {event.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(event.startTime), "MMM d 'at' h:mm a")}
                      </p>
                      {event.gameName && (
                        <p className="text-xs text-muted-foreground">{event.gameName}</p>
                      )}
                    </div>
                    <div className="flex -space-x-1">
                      {event.participants?.slice(0, 3).map((p: any) => (
                        <Avatar key={p.friend.username} className="h-6 w-6 border-2 border-background">
                          <AvatarImage src={p.friend.avatarUrl} />
                          <AvatarFallback className="text-xs">
                            {p.friend.displayName[0].toUpperCase()}
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

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Likely Streaming Today</CardTitle>
              <Link href="/friends">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {streamingNow.length === 0 && streamingSoon.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No friends expected to stream today</p>
              </div>
            ) : (
              <>
                {[...streamingNow, ...streamingSoon].slice(0, 6).map((f: any) => {
                  const isLive = liveIds.has(f.id);
                  const liveInfo = streamingNow.find((l: any) => l.id === f.id);
                  const nextSegment = f.scheduleSegments?.[0];
                  return (
                    <Link key={f.id} href={`/friends/${f.id}`}>
                      <div className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors cursor-pointer">
                        <div className="relative shrink-0">
                          <Avatar className="h-8 w-8" style={isLive && f.channelColor ? { outline: `2px solid ${f.channelColor}`, outlineOffset: "1px" } : undefined}>
                            <AvatarImage src={f.avatarUrl} />
                            <AvatarFallback>{f.displayName[0]}</AvatarFallback>
                          </Avatar>
                          {isLive && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{f.displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {isLive
                              ? `${liveInfo?.gameName || "Streaming"}${liveInfo?.viewerCount ? ` · ${liveInfo.viewerCount.toLocaleString()} viewers` : ""}`
                              : nextSegment
                              ? `${format(new Date(nextSegment.startTime), "h:mm a")}${nextSegment.gameName ? ` · ${nextSegment.gameName}` : ""}`
                              : "Usually streams today"}
                          </p>
                        </div>
                        <Badge variant={isLive ? "success" : "secondary"} className="text-xs shrink-0">
                          {isLive ? "LIVE" : nextSegment ? "Scheduled" : "Est."}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Link href="/events/new">
            <Button variant="outline">
              <CalendarPlus className="h-4 w-4" />
              Plan Collab
            </Button>
          </Link>
          <Link href="/messages">
            <Button variant="outline">
              <MessageSquare className="h-4 w-4" />
              Send Reminder
            </Button>
          </Link>
          <Button variant="outline" onClick={refreshSchedules} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh All Data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
