"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { format, isPast, isToday } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarPlus, Calendar, Clock, Gamepad2, ChevronDown, ExternalLink } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "secondary" | "destructive"> = {
  planned: "secondary",
  confirmed: "success",
  completed: "default",
  canceled: "destructive",
};

function EventRow({ event }: { event: any }) {
  const [open, setOpen] = useState(false);
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const past = isPast(end);
  const today = isToday(start);

  const nonMeParticipants = (event.participants ?? []).filter((p: any) => !p.friend.isMe);

  return (
    <div className={`rounded-lg border transition-colors ${past ? "opacity-60" : ""} ${open ? "border-slate-600 bg-slate-800/40" : "border-transparent hover:bg-slate-800/40"}`}>
      {/* Row header — clickable to toggle */}
      <button
        className="flex items-center gap-4 px-4 py-3 w-full text-left cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        {/* Date block */}
        <div className={`flex flex-col items-center justify-center w-12 shrink-0 rounded-md py-1.5 ${today ? "bg-violet-600/20 border border-violet-500/40" : "bg-slate-800"}`}>
          <span className="text-[10px] font-medium text-muted-foreground uppercase leading-none">
            {format(start, "MMM")}
          </span>
          <span className="text-lg font-bold leading-tight">{format(start, "d")}</span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{event.title}</span>
            {today && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">Today</Badge>}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(start, "h:mm a")} – {format(end, "h:mm a")}
            </span>
            {event.gameName && (
              <span className="flex items-center gap-1">
                <Gamepad2 className="h-3 w-3" />
                {event.gameName}
              </span>
            )}
          </div>
        </div>

        {/* Participants */}
        {nonMeParticipants.length > 0 && (
          <div className="flex -space-x-2 shrink-0">
            {nonMeParticipants.slice(0, 4).map((p: any) => (
              <Avatar key={p.id} className="h-7 w-7 border-2 border-card">
                <AvatarImage src={p.friend.avatarUrl} />
                <AvatarFallback className="text-[10px]">{p.friend.displayName[0]}</AvatarFallback>
              </Avatar>
            ))}
            {nonMeParticipants.length > 4 && (
              <div className="h-7 w-7 rounded-full border-2 border-card bg-slate-700 flex items-center justify-center text-[10px] font-medium">
                +{nonMeParticipants.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Status + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={STATUS_COLORS[event.status] ?? "secondary"} className="capitalize text-xs">
            {event.status}
          </Badge>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-700/60 space-y-3 animate-fade-in-up">
          {event.description && (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          )}

          {nonMeParticipants.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Participants</p>
              <div className="flex flex-wrap gap-2">
                {nonMeParticipants.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 bg-slate-800 rounded-md px-2 py-1">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={p.friend.avatarUrl} />
                      <AvatarFallback className="text-[9px]">{p.friend.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{p.friend.displayName}</span>
                    <Badge
                      variant={
                        p.inviteStatus === "accepted" ? "success" :
                        p.inviteStatus === "declined" ? "destructive" : "secondary"
                      }
                      className="text-[10px] px-1 py-0"
                    >
                      {p.inviteStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link href={`/events/${event.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5 mt-1">
              <ExternalLink className="h-3.5 w-3.5" />
              View Full Details
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function EventsPage() {
  const { data: events = [] } = useSWR("/api/events", fetcher);

  const now = new Date();
  const upcoming = events.filter((e: any) => new Date(e.endTime) >= now && e.status !== "canceled");
  const past = events.filter((e: any) => new Date(e.endTime) < now && e.status !== "canceled");
  const canceled = events.filter((e: any) => e.status === "canceled");

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Event History</h1>
        <Link href="/events/new">
          <Button>
            <CalendarPlus className="h-4 w-4" />
            New Event
          </Button>
        </Link>
      </div>

      {events.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No events yet</p>
          <p className="text-sm mb-4">Create a collab event to get started</p>
          <Link href="/events/new">
            <Button>
              <CalendarPlus className="h-4 w-4" />
              New Event
            </Button>
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Upcoming</p>
          <Card>
            <CardContent className="p-2 space-y-0.5">
              {upcoming.map((e: any) => <EventRow key={e.id} event={e} />)}
            </CardContent>
          </Card>
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Past</p>
          <Card>
            <CardContent className="p-2 space-y-0.5">
              {past.map((e: any) => <EventRow key={e.id} event={e} />)}
            </CardContent>
          </Card>
        </section>
      )}

      {canceled.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Canceled</p>
          <Card>
            <CardContent className="p-2 space-y-0.5">
              {canceled.map((e: any) => <EventRow key={e.id} event={e} />)}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
