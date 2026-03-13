"use client";

import { useState, use } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft, Calendar, Clock, Gamepad2, MessageSquare,
  Bell, Trash2, Loader2, Plus
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_OPTIONS = ["planned", "confirmed", "completed", "canceled"] as const;
const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "secondary" | "destructive"> = {
  planned: "secondary",
  confirmed: "success",
  completed: "default",
  canceled: "destructive",
};

function ReminderForm({ eventId, onAdd }: { eventId: number; onAdd: () => void }) {
  const [remindAt, setRemindAt] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function addReminder() {
    if (!remindAt) return;
    setSaving(true);
    await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, remindAt: new Date(remindAt).toISOString(), label }),
    });
    setSaving(false);
    setRemindAt("");
    setLabel("");
    onAdd();
  }

  return (
    <div className="flex gap-2 mt-3">
      <input
        type="datetime-local"
        value={remindAt}
        onChange={(e) => setRemindAt(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
      />
      <Button size="sm" onClick={addReminder} disabled={saving || !remindAt}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add
      </Button>
    </div>
  );
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: event, mutate } = useSWR(`/api/events/${id}`, fetcher);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [showReminderForm, setShowReminderForm] = useState(false);
  const router = useRouter();

  if (!event) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (event.error) {
    return <div className="text-destructive">Event not found</div>;
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
    setGeneratingInvite(true);
    setGeneratedMessage("");
    const res = await fetch("/api/ai/generate-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageType: type, eventId: event.id }),
    });
    const data = await res.json();
    setGeneratedMessage(data.content ?? "");
    setGeneratingInvite(false);
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
                  <Badge
                    variant={
                      p.inviteStatus === "accepted" ? "success" :
                      p.inviteStatus === "declined" ? "destructive" : "secondary"
                    }
                    className="text-xs"
                  >
                    {p.inviteStatus}
                  </Badge>
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
                  disabled={generatingInvite}
                >
                  {generatingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  Invite
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => generateMessage("reminder")}
                  disabled={generatingInvite}
                >
                  {generatingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                  Reminder
                </Button>
              </div>
              {generatedMessage && (
                <div className="mt-2">
                  <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap font-sans">
                    {generatedMessage}
                  </pre>
                  <div className="flex gap-2 mt-2">
                    <Link href={`/messages?eventId=${event.id}`}>
                      <Button variant="ghost" size="sm">Full Editor</Button>
                    </Link>
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Reminders</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowReminderForm(!showReminderForm)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {event.reminders?.length === 0 && !showReminderForm ? (
                <p className="text-sm text-muted-foreground">No reminders set</p>
              ) : (
                <div className="space-y-2">
                  {event.reminders?.map((r: any) => (
                    <div key={r.id} className="flex items-center gap-2 text-sm">
                      <Bell className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span>{format(new Date(r.remindAt), "MMM d 'at' h:mm a")}</span>
                      {r.label && <span className="text-muted-foreground">— {r.label}</span>}
                      {r.sent && <Badge variant="secondary" className="text-xs ml-auto">Sent</Badge>}
                    </div>
                  ))}
                  {showReminderForm && (
                    <ReminderForm eventId={event.id} onAdd={() => { mutate(); setShowReminderForm(false); }} />
                  )}
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
