"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Cap an event's end time to 23:59:59 of its start day so it stays within
 * one cell in dayGridMonth view. Capping to midnight (00:00 next day) still
 * causes FullCalendar to render a two-day block — must stop before midnight.
 */
function capEndToStartDay(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (start.getUTCDate() === end.getUTCDate() && start.getUTCMonth() === end.getUTCMonth()) {
    return endIso; // same UTC day, no change
  }
  // Cap to 23:59:59 of the start day — keeps the event inside one day cell
  const cap = new Date(start);
  cap.setUTCHours(23, 59, 59, 0);
  return cap.toISOString();
}

// Fallback palette when a friend hasn't set a Twitch channel color
const FALLBACK_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

function getFriendColor(friend: any, index: number): string {
  return friend.channelColor || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export default function CalendarPage() {
  const router = useRouter();
  const calRef = useRef<any>(null);
  const [currentRange, setCurrentRange] = useState({
    from: startOfMonth(new Date()).toISOString(),
    to: endOfMonth(new Date()).toISOString(),
  });
  const [hiddenFriends, setHiddenFriends] = useState<Set<number>>(new Set());
  const [initialized, setInitialized] = useState(false);

  const { data } = useSWR(
    `/api/calendar?from=${currentRange.from}&to=${currentRange.to}`,
    fetcher
  );
  const { data: friends = [] } = useSWR("/api/friends", fetcher);

  // Start with all non-me friends hidden
  useEffect(() => {
    if (!initialized && friends.length > 0) {
      const nonMeIds = friends.filter((f: any) => !f.isMe).map((f: any) => f.id);
      setHiddenFriends(new Set(nonMeIds));
      setInitialized(true);
    }
  }, [friends, initialized]);

  const meFriend = friends.find((f: any) => f.isMe);
  const nonMeFriends = friends.filter((f: any) => !f.isMe);

  // Build color map using each friend's Twitch channel color (with fallback)
  const friendColorMap = new Map(
    nonMeFriends.map((f: any, i: number) => [f.id, getFriendColor(f, i)])
  );

  const events = data?.events ?? [];
  const scheduleSegments = data?.scheduleSegments ?? [];
  const inferredWindows = data?.inferredWindows ?? [];

  const calendarEvents = [
    // Planned events — solid purple
    ...events.map((e: any) => ({
      id: `event-${e.id}`,
      title: e.title,
      start: e.startTime,
      end: e.endTime,
      backgroundColor: "#7c3aed",
      borderColor: "#6d28d9",
      extendedProps: { type: "event", eventId: e.id },
    })),

    // "Me" inferred windows — subtle pill showing your usual stream time
    ...(meFriend
      ? inferredWindows
          .filter((w: any) => w.friendId === meFriend.id)
          .map((w: any, i: number) => ({
            id: `me-${i}`,
            title: "Your stream time",
            start: w.start,
            end: capEndToStartDay(w.start, w.end),
            backgroundColor: "#7c3aed22",
            borderColor: "#7c3aed55",
            textColor: "#a78bfa",
            extendedProps: { type: "me" },
          }))
      : []),

    // Friend posted schedules — only when toggled on
    ...scheduleSegments
      .filter((s: any) => !hiddenFriends.has(s.friendId))
      .map((s: any) => ({
        id: `seg-${s.id}`,
        title: `${s.friend.displayName}: ${s.title}`,
        start: s.startTime,
        end: capEndToStartDay(s.startTime, s.endTime),
        backgroundColor: (friendColorMap.get(s.friendId) ?? "#64748b") + "40",
        borderColor: friendColorMap.get(s.friendId) ?? "#64748b",
        textColor: "#e2e8f0",
        extendedProps: { type: "schedule", friendId: s.friendId },
      })),

    // Friend inferred windows — only when toggled on
    ...inferredWindows
      .filter((w: any) => !w.isMe && !hiddenFriends.has(w.friendId))
      .map((w: any, i: number) => ({
        id: `inferred-${w.friendId}-${i}`,
        title: w.displayName,
        start: w.start,
        end: capEndToStartDay(w.start, w.end),
        backgroundColor: (friendColorMap.get(w.friendId) ?? "#64748b") + "20",
        borderColor: (friendColorMap.get(w.friendId) ?? "#64748b") + "60",
        textColor: "#94a3b8",
        extendedProps: { type: "inferred", friendId: w.friendId },
      })),
  ];

  function handleDateSet(dateInfo: any) {
    setCurrentRange({ from: dateInfo.startStr, to: dateInfo.endStr });
  }

  function handleEventClick(info: any) {
    if (info.event.extendedProps.type === "event") {
      router.push(`/events/${info.event.extendedProps.eventId}`);
    }
  }

  function handleDateClick(info: any) {
    router.push(`/events/new?startTime=${info.dateStr}`);
  }

  function toggleFriend(friendId: number) {
    setHiddenFriends((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Calendar</h1>
        <Link href="/events/new">
          <Button>
            <CalendarPlus className="h-4 w-4" />
            New Event
          </Button>
        </Link>
      </div>

      {nonMeFriends.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Show friend streams:</span>
              {nonMeFriends.map((f: any, i: number) => {
                const color = getFriendColor(f, i);
                const hidden = hiddenFriends.has(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleFriend(f.id)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-all hover:opacity-90"
                    style={{ borderColor: color, opacity: hidden ? 0.35 : 1 }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    {f.displayName}
                    {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek",
            }}
            events={calendarEvents}
            datesSet={handleDateSet}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            height="auto"
            dayMaxEvents={3}
            eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-violet-600" />
          Your events
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#7c3aed22", border: "1px solid #7c3aed55" }} />
          Your usual stream times
        </div>
        <span>Click a date to create an event</span>
      </div>
    </div>
  );
}
