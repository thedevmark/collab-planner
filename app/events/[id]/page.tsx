"use client";

import { useState, use } from "react";
import useSWR from "swr";
import { format, isPast, addHours } from "date-fns";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  ArrowLeft, Calendar, Clock, Gamepad2,
  Bell, Trash2, Loader2, Edit2, Check, X, Link2,
} from "lucide-react";
import { MessageBlock } from "@/components/events/MessageBlock";
import { InviteDialog } from "@/components/InviteDialog";
import {
  nextParticipantResponseStatus,
  participantResponseBadgeVariant,
  participantResponseLabel,
} from "@/lib/participantStatus";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_OPTIONS = ["planned", "confirmed", "completed", "canceled"] as const;
const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "secondary" | "destructive"> = {
  planned: "secondary",
  confirmed: "success",
  completed: "default",
  canceled: "destructive",
};

type EventParticipant = {
  id: number;
  inviteStatus: string;
  friend: {
    displayName: string;
    username: string;
    avatarUrl: string | null;
    isMe: boolean;
  };
};

type EventReminder = {
  id: number;
  label: string | null;
  remindAt: string;
  sent: boolean;
};

type EventDetail = {
  id: number;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  gameName: string | null;
  status: string;
  participants: EventParticipant[];
  reminders: EventReminder[];
  error?: string;
};

function toLocalDatetimeValue(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: event, mutate } = useSWR<EventDetail>(`/api/events/${id}`, fetcher);
  const { data: friends = [] } = useSWR("/api/friends", fetcher);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editGameName, setEditGameName] = useState("");
  const [saving, setSaving] = useState(false);

  const router = useRouter();

  if (!event) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (event.error) {
    return <div className="text-destructive">Event not found</div>;
  }

  const currentEvent: EventDetail = event;
  const isPastEvent = isPast(new Date(currentEvent.endTime));

  function startEditing() {
    setEditTitle(currentEvent.title);
    setEditDescription(currentEvent.description ?? "");
    setEditStartTime(toLocalDatetimeValue(new Date(currentEvent.startTime)));
    setEditEndTime(toLocalDatetimeValue(new Date(currentEvent.endTime)));
    setEditGameName(currentEvent.gameName ?? "");
    setEditing(true);
  }

  async function saveEdits() {
    setSaving(true);
    try {
      await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          startTime: new Date(editStartTime).toISOString(),
          endTime: new Date(editEndTime).toISOString(),
          gameName: editGameName,
        }),
      });
      mutate();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: string) {
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    mutate();
  }

  async function cycleParticipantStatus(participantId: number, currentStatus: string) {
    const nextStatus = nextParticipantResponseStatus(currentStatus);
    await fetch(`/api/events/${id}/participants`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId, inviteStatus: nextStatus }),
    });
    mutate();
  }

  async function deleteEvent() {
    if (!confirm("Cancel this event?")) return;
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    router.push("/events");
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/events">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {editing ? (
            /* Edit mode */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="What's the plan?"
                  className="min-h-[60px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Start Time</Label>
                  <DateTimePicker
                    value={editStartTime}
                    onChange={(v) => {
                      setEditStartTime(v);
                      if (v) setEditEndTime(toLocalDatetimeValue(addHours(new Date(v), 3)));
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End Time</Label>
                  <DateTimePicker value={editEndTime} onChange={setEditEndTime} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-game">Game or Genre</Label>
                <Input
                  id="edit-game"
                  value={editGameName}
                  onChange={(e) => setEditGameName(e.target.value)}
                  placeholder="e.g. Minecraft, horror games..."
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdits} disabled={saving || !editTitle}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            /* View mode */
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">{currentEvent.title}</h1>
                  {currentEvent.description && (
                    <p className="text-muted-foreground mt-1">{currentEvent.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={STATUS_COLORS[currentEvent.status] ?? "secondary"}>
                    {currentEvent.status}
                  </Badge>
                  {!isPastEvent && (
                    <Button variant="ghost" size="sm" onClick={startEditing}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={deleteEvent}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(currentEvent.startTime), "EEEE, MMMM d, yyyy")}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(currentEvent.startTime), "h:mm a")} –{" "}
                  {format(new Date(currentEvent.endTime), "h:mm a")}
                </div>
                {currentEvent.gameName && (
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                    {currentEvent.gameName}
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                {STATUS_OPTIONS.map((s) => (
                  <Button
                    key={s}
                    variant={currentEvent.status === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateStatus(s)}
                    className="capitalize"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Participants */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Participants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentEvent.participants?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No participants added</p>
            ) : (
              currentEvent.participants?.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={p.friend.avatarUrl ?? undefined} />
                    <AvatarFallback>{p.friend.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.friend.displayName}</p>
                    {p.friend.isMe && <p className="text-xs text-muted-foreground">you</p>}
                  </div>
                  <button
                    onClick={() => !p.friend.isMe && cycleParticipantStatus(p.id, p.inviteStatus)}
                    disabled={p.friend.isMe}
                    title={p.friend.isMe ? undefined : "Click to cycle response"}
                    className="disabled:cursor-default"
                  >
                    <Badge
                      variant={participantResponseBadgeVariant(p.inviteStatus)}
                      className={`text-xs ${!p.friend.isMe ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                    >
                      {participantResponseLabel(p.inviteStatus)}
                    </Badge>
                  </button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-4">
          {/* Message block */}
          <MessageBlock
            title={currentEvent.title}
            gameName={currentEvent.gameName ?? undefined}
            startTime={new Date(currentEvent.startTime)}
            endTime={new Date(currentEvent.endTime)}
            participants={currentEvent.participants
              ?.filter((p) => !p.friend.isMe)
              .map((p) => ({
              displayName: p.friend.displayName,
              twitchUsername: p.friend.username,
            })) ?? []}
          />

          {/* Share invite link */}
          <InviteDialog
            friends={friends}
            defaultFriendIds={currentEvent.participants?.map((p) => p.friend).filter((f) => !f.isMe).map((f) => friends.find((fr: any) => fr.username === f.username)?.id).filter(Boolean) ?? []}
          >
            <Button variant="outline" className="w-full">
              <Link2 className="h-4 w-4" />
              Share Invite Link
            </Button>
          </InviteDialog>

          {/* Reminders */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Auto Reminders</CardTitle>
            </CardHeader>
            <CardContent>
              {currentEvent.reminders?.length === 0 ? (
                <p className="text-sm text-muted-foreground">All reminders have passed.</p>
              ) : (
                <div className="space-y-2">
                  {currentEvent.reminders?.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-sm">
                      <Bell className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {format(new Date(r.remindAt), "MMM d 'at' h:mm a")}
                      </span>
                      {r.sent && <Badge variant="secondary" className="text-xs">Sent</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
