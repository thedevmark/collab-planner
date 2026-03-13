"use client";

import { useState, Suspense } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Bell, Copy, Check, Loader2, Wand2 } from "lucide-react";
import { useClipboard } from "@/hooks/useClipboard";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function MessagesForm() {
  const searchParams = useSearchParams();
  const { data: events = [] } = useSWR("/api/events", fetcher);
  const { data: allFriends = [] } = useSWR("/api/friends", fetcher);
  const friends = allFriends.filter((f: any) => !f.isMe);

  const [messageType, setMessageType] = useState<"invite" | "reminder">("invite");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(
    searchParams.get("eventId") ? parseInt(searchParams.get("eventId")!) : null
  );
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const { copy, copied } = useClipboard();

  async function generate() {
    setGenerating(true);
    setGeneratedMessage("");
    try {
      const res = await fetch("/api/ai/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageType,
          eventId: selectedEventId ?? undefined,
          friendIds: selectedFriendIds.length > 0 ? selectedFriendIds : undefined,
          additionalContext: additionalContext || undefined,
        }),
      });
      const data = await res.json();
      setGeneratedMessage(data.content ?? data.error ?? "");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Discord Messages</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Message Type</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Button
                variant={messageType === "invite" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setMessageType("invite")}
              >
                <MessageSquare className="h-4 w-4" />
                Invite
              </Button>
              <Button
                variant={messageType === "reminder" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setMessageType("reminder")}
              >
                <Bell className="h-4 w-4" />
                Reminder
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Event (optional)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <button
                className={`w-full text-left px-3 py-2 rounded-md border text-sm ${selectedEventId === null ? "border-primary bg-primary/10" : "hover:bg-accent"}`}
                onClick={() => setSelectedEventId(null)}
              >
                No specific event
              </button>
              {events.slice(0, 8).map((e: any) => (
                <button
                  key={e.id}
                  className={`w-full text-left px-3 py-2 rounded-md border text-sm ${selectedEventId === e.id ? "border-primary bg-primary/10" : "hover:bg-accent"}`}
                  onClick={() => setSelectedEventId(e.id)}
                >
                  <p className="font-medium truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(e.startTime), "MMM d")}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {!selectedEventId && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Friends to mention</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {friends.map((f: any) => {
                  const selected = selectedFriendIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFriendIds(prev =>
                        prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id]
                      )}
                      className={`w-full flex items-center gap-2 p-2 rounded-md border text-sm ${selected ? "border-primary bg-primary/10" : "hover:bg-accent"}`}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={f.avatarUrl} />
                        <AvatarFallback className="text-xs">{f.displayName[0]}</AvatarFallback>
                      </Avatar>
                      <span>{f.displayName}</span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Additional Context</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                placeholder="Any extra details for the AI..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                className="min-h-[80px]"
              />
            </CardContent>
          </Card>

          <Button className="w-full" onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Generate Message
          </Button>
        </div>

        {/* Preview + history */}
        <div className="col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Preview</CardTitle>
                {generatedMessage && (
                  <Button size="sm" onClick={() => copy(generatedMessage)}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {generating ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : generatedMessage ? (
                <pre className="text-sm whitespace-pre-wrap font-sans bg-muted p-4 rounded-md min-h-[160px]">
                  {generatedMessage}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Wand2 className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Configure options and click Generate</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Message log from DB */}
          <MessageLogSection />
        </div>
      </div>
    </div>
  );
}

function MessageLogSection() {
  const [page, setPage] = useState(0);
  const { copy, copied } = useClipboard();

  // We'll fetch message logs via a new API route
  const { data: logs = [] } = useSWR("/api/messages/logs?limit=10", fetcher, {
    revalidateOnFocus: false,
  });

  if (logs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Message History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {logs.map((m: any) => (
          <div key={m.id} className="border rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className="capitalize">{m.messageType}</Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(m.createdAt), "MMM d, h:mm a")}
              </span>
            </div>
            <pre className="text-xs whitespace-pre-wrap font-sans line-clamp-4">{m.content}</pre>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 h-7"
              onClick={() => copy(m.content)}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Copy
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesForm />
    </Suspense>
  );
}
