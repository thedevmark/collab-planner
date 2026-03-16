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
  ArrowLeft, Calendar, Clock, Gamepad2, MessageSquare,
  Bell, Trash2, Loader2, Edit2, Check, X,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_OPTIONS = ["planned", "confirmed", "completed", "canceled"] as const;
const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "secondary" | "destructive"> = {
  planned: "secondary",
  confirmed: "success",
  completed: "default",
  canceled: "destructive",
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
  const { data: event, mutate } = useSWR(`/api/events/${id}`, fetcher);
  const [generatingType, setGeneratingType] = useState<"invite" | "reminder" | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState("");

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

  const isPastEvent = isPast(new Date(event.endTime));

  function startEditing() {
    setEditTitle(event.title);
    setEditDescription(event.description ?? "");
    setEditStartTime(toLocalDatetimeValue(new Date(event.startTime)));
    setEditEndTime(toLocalDatetimeValue(new Date(event.endTime)));
    setEditGameName(event.gameName ?? "");
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

  async function generateMessage(type: "invite" | "reminder") {
    setGeneratingType(type);
    setGeneratedMessage("");
    const res = await fetch("/api/ai/generate-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageType: type, eventId: event.id }),
    });
    const data = await res.json();
    setGeneratedMessage(data.content ?? "");
    setGeneratingType(null);
  }

  const INVITE_STATUS_CYCLE: Record<string, string> = {
    pending: "confirmed",
    confirmed: "cannot",
    cannot: "pending",
  };

  async function cycleParticipantStatus(participantId: number, currentStatus: string) {
    const nextStatus = INVITE_STATUS_CYCLE[currentStatus] ?? "pending";
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
    router.push("/calendar");
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/calendar">
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
                  <h1 className="text-2xl font-bold">{event.title}</h1>
                  {event.description && (
                    <p className="text-muted-foreground mt-1">{event.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={STATUS_COLORS[event.status] ?? "secondary"}>
                    {event.status}
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
                  {format(new Date(event.startTime), "EEEE, MMMM d, yyyy")}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(event.startTime), "h:mm a")} –{" "}
                  {format(new Date(event.endTime), "h:mm a")}
                </div>
                {event.gameName && (
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                    {event.gameName}
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                {STATUS_OPTIONS.map((s) => (
                  <Button
                    key={s}
                    variant={event.status === s ? "default" : "outline"}
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
            {event.participants?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No participants added</p>
            ) : (
              event.participants?.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={p.friend.avatarUrl} />
                    <AvatarFallback>{p.friend.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.friend.displayName}</p>
                    {p.friend.isMe && <p className="text-xs text-muted-foreground">you</p>}
                  </div>
                  <button
                    onClick={() => !p.friend.isMe && cycleParticipantStatus(p.id, p.inviteStatus)}
                    disabled={p.friend.isMe}
                    title={p.friend.isMe ? undefined : "Click to cycle status"}
                    className="disabled:cursor-default"
                  >
                    <Badge
                      variant={
                        p.inviteStatus === "confirmed" ? "success" :
                        p.inviteStatus === "cannot" ? "destructive" : "secondary"
                      }
                      className={`text-xs ${!p.friend.isMe ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                    >
                      {p.inviteStatus}
                    </Badge>
                  </button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-4">
          {/* Message generation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Discord Messages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => generateMessage("invite")}
                  disabled={generatingType !== null}
                >
                  {generatingType === "invite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  {generatingType === "invite" ? "Generating..." : "Invite"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => generateMessage("reminder")}
                  disabled={generatingType !== null}
                >
                  {generatingType === "reminder" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                  {generatingType === "reminder" ? "Generating..." : "Reminder"}
                </Button>
              </div>
              {generatedMessage && (
                <div className="mt-2">
                  <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap font-sans">
                    {generatedMessage}
                  </pre>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(generatedMessage)}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reminders */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Auto Reminders</CardTitle>
            </CardHeader>
            <CardContent>
              {event.reminders?.length === 0 ? (
                <p className="text-sm text-muted-foreground">All reminders have passed.</p>
              ) : (
                <div className="space-y-2">
                  {event.reminders?.map((r: any) => (
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

      {/* Message logs */}
      {event.messageLogs?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Message History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {event.messageLogs.map((m: any) => (
              <div key={m.id} className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="capitalize">{m.messageType}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(m.createdAt), "MMM d, h:mm a")}
                  </span>
                </div>
                <pre className="text-xs whitespace-pre-wrap font-sans">{m.content}</pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => navigator.clipboard.writeText(m.content)}
                >
                  Copy
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
