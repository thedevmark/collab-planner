"use client";

import { useState, use } from "react";
import useSWR from "swr";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, ArrowLeft, Clock, Gamepad2, Edit2, Check, X, Trash2, History, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getStreamingPattern(streamHistory: any[], scheduleSegments: any[]) {
  const dayCounts: Record<number, number> = {};
  const hourCounts: number[] = [];
  const gameCounts: Record<string, number> = {};
  let totalSec = 0;
  let source: "history" | "schedule" | "mixed" | "estimated" = "estimated";

  // Primary: stream history
  for (const s of streamHistory ?? []) {
    const d = new Date(s.startTime).getDay();
    dayCounts[d] = (dayCounts[d] ?? 0) + 1;
    hourCounts.push(new Date(s.startTime).getUTCHours());
    if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + 1;
    totalSec += s.durationSec;
  }

  if ((streamHistory?.length ?? 0) >= 3) {
    source = scheduleSegments?.length > 0 ? "mixed" : "history";
  }

  // Supplement with schedule if available
  for (const s of scheduleSegments ?? []) {
    const d = new Date(s.startTime).getDay();
    dayCounts[d] = (dayCounts[d] ?? 0) + (s.isRecurring ? 2 : 1) * 0.5;
    hourCounts.push(new Date(s.startTime).getUTCHours());
    if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + 0.5;
    if (source === "estimated") source = "schedule";
  }

  // Default estimates if truly no data
  if (hourCounts.length === 0) {
    return {
      topDays: ["Fri", "Sat", "Sun"],
      typicalTime: "~8PM UTC (estimated)",
      topGames: [] as string[],
      avgHours: 3,
      total: 0,
      source: "estimated" as const,
    };
  }

  const topDays = Object.entries(dayCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([d]) => DAYS[parseInt(d)]);

  hourCounts.sort((a, b) => a - b);
  const medianHour = hourCounts[Math.floor(hourCounts.length / 2)];
  const ampm = medianHour >= 12 ? "PM" : "AM";
  const h = medianHour % 12 || 12;
  const typicalTime = `~${h}${ampm} UTC`;

  const topGames = Object.entries(gameCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([g]) => g);

  const avgHours = streamHistory?.length > 0
    ? Math.round((totalSec / streamHistory.length / 3600) * 10) / 10
    : 3;

  return { topDays, typicalTime, topGames, avgHours, total: streamHistory?.length ?? 0, source };
}

export default function FriendDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: friend, mutate } = useSWR(`/api/friends/${id}`, fetcher);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  if (!friend) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (friend.error) {
    return <div className="text-destructive">Friend not found</div>;
  }

  async function saveNotes() {
    await fetch(`/api/friends/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    mutate();
    setEditingNotes(false);
  }

  async function refreshHistory() {
    setRefreshing(true);
    await Promise.all([
      fetch(`/api/friends/${id}/history/stream`, { method: "POST" }),
      fetch(`/api/friends/${id}/schedule`, { method: "POST" }),
    ]);
    mutate();
    setRefreshing(false);
  }

  async function removeFriend() {
    if (!confirm(`Remove ${friend.displayName}?`)) return;
    await fetch(`/api/friends/${id}`, { method: "DELETE" });
    router.push("/friends");
  }

  const pattern = getStreamingPattern(friend.streamHistory, friend.scheduleSegments);
  const upcomingSegments = friend.scheduleSegments?.filter(
    (s: any) => new Date(s.endTime) > new Date()
  ) ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/friends">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      {/* Profile header */}
      <Card style={friend.channelColor ? { borderColor: friend.channelColor + "60" } : undefined}>
        {friend.channelColor && (
          <div className="h-1 rounded-t-lg" style={{ backgroundColor: friend.channelColor }} />
        )}
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20" style={friend.channelColor ? { outline: `2px solid ${friend.channelColor}40`, outlineOffset: "2px" } : undefined}>
              <AvatarImage src={friend.avatarUrl} />
              <AvatarFallback className="text-2xl">{friend.displayName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{friend.displayName}</h1>
              <p className="text-muted-foreground">@{friend.username}</p>
              <div className="mt-3 flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={refreshHistory} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh Data
                </Button>
                <Link href={`/events/new?friendId=${friend.id}`}>
                  <Button size="sm">Plan Collab</Button>
                </Link>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={removeFriend}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Streaming pattern from history */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Streaming Pattern
              <Badge
                variant={pattern.source === "estimated" ? "outline" : pattern.source === "history" || pattern.source === "mixed" ? "success" : "secondary"}
                className="text-xs ml-auto"
              >
                {pattern.source === "estimated" ? "estimated" :
                 pattern.source === "schedule" ? "from schedule" :
                 pattern.source === "mixed" ? `${pattern.total} streams + schedule` :
                 `${pattern.total} streams`}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Typical streaming days</p>
                <div className="flex gap-1">
                  {DAYS.map((d) => (
                    <span
                      key={d}
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        pattern.topDays.includes(d)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Usual start time</p>
                  <p className="font-medium">{pattern.typicalTime}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg session</p>
                  <p className="font-medium">{pattern.avgHours}h</p>
                </div>
              </div>
              {pattern.topGames.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Most played games</p>
                  <div className="flex flex-wrap gap-1">
                    {pattern.topGames.map((g) => (
                      <Badge key={g} variant="outline" className="text-xs">{g}</Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No game data yet —{" "}
                  <button className="underline" onClick={refreshHistory}>refresh</button> to pull stream history
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent streams */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Recent Streams
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!friend.streamHistory?.length ? (
              <p className="text-sm text-muted-foreground">No stream history</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {friend.streamHistory.slice(0, 10).map((s: any) => (
                  <div key={s.id} className="text-xs border-l-2 border-muted pl-2 py-0.5">
                    <p className="font-medium truncate">{s.title}</p>
                    <p className="text-muted-foreground">
                      {format(new Date(s.startTime), "EEE MMM d, h:mm a")}
                      {s.durationSec ? ` · ${Math.round(s.durationSec / 3600 * 10) / 10}h` : ""}
                      {s.gameName ? ` · ${s.gameName}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Twitch schedule (if available) */}
        {upcomingSegments.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Posted Schedule
                <Badge variant="secondary" className="text-xs ml-auto">Optional</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {upcomingSegments.map((s: any) => (
                  <div key={s.id} className="border rounded-md p-2 text-xs space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{s.title}</p>
                      {s.isRecurring && <Badge variant="outline" className="text-xs shrink-0">Recurring</Badge>}
                    </div>
                    <p className="text-muted-foreground">
                      {format(new Date(s.startTime), "EEE MMM d, h:mm a")} – {format(new Date(s.endTime), "h:mm a")}
                    </p>
                    {s.gameName && <p className="text-muted-foreground">{s.gameName}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes + collab history */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Notes</CardTitle>
                {!editingNotes ? (
                  <Button variant="ghost" size="sm" onClick={() => { setNotes(friend.notes ?? ""); setEditingNotes(true); }}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={saveNotes}><Check className="h-4 w-4 text-green-600" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingNotes(false)}><X className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingNotes ? (
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes about this streamer..." className="min-h-[80px]" />
              ) : (
                <p className="text-sm text-muted-foreground">{friend.notes || "No notes yet."}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Collab History</CardTitle>
            </CardHeader>
            <CardContent>
              {friend.collabHistories?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">No collabs yet</p>
              ) : (
                <div className="space-y-2">
                  {friend.collabHistories?.map((h: any) => (
                    <div key={h.id} className="text-sm border-l-2 border-primary pl-3">
                      <p className="font-medium">{h.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(h.date), "MMM d, yyyy")}{h.gameName ? ` · ${h.gameName}` : ""}
                      </p>
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
