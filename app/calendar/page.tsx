"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import useSWR from "swr";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Eye, EyeOff, Tv2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Cap an event's end time to 23:59:59 LOCAL time of its start day so it stays
 * within one cell in dayGridMonth view. FullCalendar renders in local time, so
 * we must compare and cap using local dates — NOT UTC — otherwise a stream
 * starting at e.g. 8 PM local (02:00 UTC next day) that gets UTC-capped to
 * 23:59:59 UTC will still appear as a two-day block in the calendar.
 */
function capEndToStartDay(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  // Compare LOCAL calendar dates (what FullCalendar sees)
  const sameLocalDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameLocalDay) return endIso;
  // Cap to 23:59:59 LOCAL time of the start day
  const cap = new Date(start);
  cap.setHours(23, 59, 59, 0);
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

function renderEventContent(eventInfo: any) {
  const { type } = eventInfo.event.extendedProps;

  if (type === "me") {
    return <div aria-hidden="true" className="calendar-me-window-fill" />;
  }

  if (type === "event") {
    return (
      <div className="calendar-planned-event-content">
        <span className="calendar-planned-event-dot" />
        <div className="calendar-planned-event-body">
          {eventInfo.timeText && (
            <span className="calendar-planned-event-time">{eventInfo.timeText}</span>
          )}
          <span className="calendar-planned-event-title">{eventInfo.event.title}</span>
        </div>
      </div>
    );
  }

  if (type === "schedule") {
    const { color, displayName } = eventInfo.event.extendedProps;
    return (
      <div className="calendar-friend-event-content" style={{ borderLeftColor: color }}>
        <span className="calendar-friend-event-dot" style={{ background: color }} />
        <div className="calendar-friend-event-body">
          <div className="flex items-center gap-1.5">
            <span className="calendar-friend-event-name" style={{ color }}>{displayName}</span>
            {eventInfo.timeText && (
              <span className="calendar-friend-event-time">{eventInfo.timeText}</span>
            )}
          </div>
          <span className="calendar-friend-event-title">{eventInfo.event.title}</span>
        </div>
      </div>
    );
  }

  if (type === "inferred") {
    const { color, displayName } = eventInfo.event.extendedProps;
    return (
      <div className="calendar-friend-inferred-content" style={{ borderLeftColor: color + "80" }}>
        <span className="calendar-friend-inferred-dot" style={{ background: color + "90" }} />
        <span className="calendar-friend-inferred-name">{displayName}</span>
      </div>
    );
  }

  return (
    <div className="fc-event-main-frame">
      {eventInfo.timeText ? <div className="fc-event-time">{eventInfo.timeText}</div> : null}
      <div className="fc-event-title-container">
        <div className="fc-event-title fc-sticky">{eventInfo.event.title}</div>
      </div>
    </div>
  );
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
  const [showMyStreamDays, setShowMyStreamDays] = useState(true);

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

  // Dates where "me" has an inferred stream window — used to tint day cells
  const meDates = useMemo(() => {
    if (!meFriend) return new Set<string>();
    return new Set(
      inferredWindows
        .filter((w: any) => w.friendId === meFriend.id)
        .map((w: any) => {
          const d = new Date(w.start);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })
    );
  }, [inferredWindows, meFriend]);

  // Friends with posted schedule segments — their inferred windows are redundant
  const friendsWithSchedule = new Set(
    scheduleSegments
      .filter((s: any) => !hiddenFriends.has(s.friendId))
      .map((s: any) => s.friendId)
  );

  const calendarEvents = [
    // Planned events — solid purple
    ...events.map((e: any) => ({
      id: `event-${e.id}`,
      title: e.title,
      start: e.startTime,
      end: e.endTime,
      backgroundColor: "hsl(215 28% 18%)",
      borderColor: "hsl(215 25% 26%)",
      classNames: ["calendar-planned-event"],
      extendedProps: { type: "event", eventId: e.id },
    })),

    // Friend posted schedules — only when toggled on
    ...scheduleSegments
      .filter((s: any) => !hiddenFriends.has(s.friendId))
      .map((s: any) => {
        const color = friendColorMap.get(s.friendId) ?? "#64748b";
        return {
          id: `seg-${s.id}`,
          title: s.title,
          start: s.startTime,
          end: capEndToStartDay(s.startTime, s.endTime),
          backgroundColor: "hsl(215 28% 15%)",
          borderColor: "hsl(215 25% 22%)",
          classNames: ["calendar-friend-event"],
          extendedProps: { type: "schedule", friendId: s.friendId, color, displayName: s.friend.displayName },
        };
      }),

    // Friend inferred windows — only when toggled on and no posted schedule exists
    ...inferredWindows
      .filter((w: any) => !w.isMe && !hiddenFriends.has(w.friendId) && !friendsWithSchedule.has(w.friendId))
      .map((w: any, i: number) => {
        const color = friendColorMap.get(w.friendId) ?? "#64748b";
        return {
          id: `inferred-${w.friendId}-${i}`,
          title: w.displayName,
          start: w.start,
          end: capEndToStartDay(w.start, w.end),
          backgroundColor: "hsl(215 25% 11%)",
          borderColor: "hsl(215 25% 18%)",
          classNames: ["calendar-friend-inferred"],
          extendedProps: { type: "inferred", friendId: w.friendId, color, displayName: w.displayName },
        };
      }),
  ];

  function handleDateSet(dateInfo: any) {
    setCurrentRange({ from: dateInfo.startStr, to: dateInfo.endStr });
  }

  function handleEventClick(info: any) {
    const { type, eventId, friendId } = info.event.extendedProps;
    if (type === "event") {
      router.push(`/events/${eventId}`);
      return;
    }

    if (type === "schedule" || type === "inferred") {
      // Find the clicked event's date (local)
      const clickedDate = info.event.start as Date;
      const clickedKey = `${clickedDate.getFullYear()}-${String(clickedDate.getMonth() + 1).padStart(2, "0")}-${String(clickedDate.getDate()).padStart(2, "0")}`;

      // Gather all visible friends that have a segment or inferred window on this same local day
      const visibleFriendIdsOnDay = new Set<number>([friendId]);

      for (const s of scheduleSegments) {
        if (hiddenFriends.has(s.friendId)) continue;
        const d = new Date(s.startTime);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (key === clickedKey) visibleFriendIdsOnDay.add(s.friendId);
      }
      for (const w of inferredWindows) {
        if (w.isMe || hiddenFriends.has(w.friendId)) continue;
        const d = new Date(w.start);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (key === clickedKey) visibleFriendIdsOnDay.add(w.friendId);
      }

      const ids = Array.from(visibleFriendIdsOnDay).join(",");
      router.push(`/events/new?startTime=${clickedKey}&friendIds=${ids}`);
    }
  }

  function handleDateClick(info: any) {
    const el = info.dayEl as HTMLElement;
    el.style.position = "relative";
    el.style.overflow = "hidden";
    const ripple = document.createElement("span");
    ripple.className = "calendar-date-ripple";
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
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
        <h1 className="text-3xl font-bold">Calendar Helper</h1>
        <Link href="/events/new">
          <Button>
            <CalendarPlus className="h-4 w-4" />
            New Session
          </Button>
        </Link>
      </div>

      {(nonMeFriends.length > 0 || meDates.size > 0) && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {meDates.size > 0 && (
                <>
                  <span className="text-xs text-muted-foreground mr-1">My days:</span>
                  <button
                    onClick={() => setShowMyStreamDays((v) => !v)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-all hover:brightness-125 active:scale-95"
                    style={{ borderColor: "hsl(var(--primary))", opacity: showMyStreamDays ? 1 : 0.35 }}
                  >
                    <Tv2 className="h-3 w-3" style={{ color: "hsl(var(--primary))" }} />
                    My stream days
                    {showMyStreamDays ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </button>
                  {nonMeFriends.length > 0 && <span className="w-px h-4 bg-border mx-1" />}
                </>
              )}
              {nonMeFriends.length > 0 && (
                <>
                  <span className="text-xs text-muted-foreground mr-1">Friend streams:</span>
                  {nonMeFriends.map((f: any, i: number) => {
                    const color = getFriendColor(f, i);
                    const hidden = hiddenFriends.has(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => toggleFriend(f.id)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-all hover:brightness-125 active:scale-95"
                        style={{ borderColor: color, opacity: hidden ? 0.35 : 1 }}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        {f.displayName}
                        {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    );
                  })}
                </>
              )}
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
            eventContent={renderEventContent}
            dayCellClassNames={(arg) => {
              const d = arg.date;
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              return showMyStreamDays && meDates.has(key) ? ["calendar-my-stream-day"] : [];
            }}
            height="auto"
            dayMaxEvents={3}
            eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-primary" />
          Your events
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm relative overflow-hidden" style={{ background: "linear-gradient(to top, hsl(221 83% 73% / 0.2) 0%, transparent 100%)", border: "1px solid hsl(221 83% 73% / 0.25)" }}>
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/60" />
          </span>
          Your usual stream time
        </div>
        <span>Click a date to create an event</span>
        <span className="ml-auto text-xs text-muted-foreground/60">
          Times: {Intl.DateTimeFormat().resolvedOptions().timeZone} ({new Intl.DateTimeFormat("en", { timeZoneName: "short" }).formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value})
        </span>
      </div>
    </div>
  );
}
