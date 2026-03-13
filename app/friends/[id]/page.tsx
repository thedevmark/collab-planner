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
import { RefreshCw, ArrowLeft, Clock, Edit2, Check, X, Trash2, History, TrendingUp, Users2 } from "lucide-react";
import { useRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getStreamingPattern(streamHistory: any[], scheduleSegments: any[]) {
  const dayCounts: Record<number, number> = {};
  const hourCounts: number[] = [];
  const gameCounts: Record<string, number> = {};
  let totalSec = 0;
  let source: "history" | "schedule" | "mixed" | "estimated" = "estimated";

  for (const s of streamHistory ?? []) {
    const d = new Date(s.startTime).getUTCDay();
    dayCounts[d] = (dayCounts[d] ?? 0) + 1;
    hourCounts.push(new Date(s.startTime).getUTCHours());
    if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + 1;
    totalSec += s.durationSec;
  }

  if ((streamHistory?.length ?? 0) >= 3) {
    source = scheduleSegments?.length > 0 ? "mixed" : "history";
  }

  for (const s of scheduleSegments ?? []) {
    const d = new Date(s.startTime).getUTCDay();
    dayCounts[d] = (dayCounts[d] ?? 0) + (s.isRecurring ? 2 : 1) * 0.5;
    hourCounts.push(new Date(s.startTime).getUTCHours());
    if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + 0.5;
    if (source === "estimated") source = "schedule";
  }

  if (hourCounts.length === 0) {
    return { topDays: ["Fri", "Sat", "Sun"], typicalTime: "~8PM UTC (estimated)", topGames: [] as string[], avgHours: 3, total: 0, source: "estimated" as const };
  }

  const topDays = Object.entries(dayCounts).sort(([, a], [, b]) => b - a).slice(0, 3).map(([d]) => DAYS[parseInt(d)]);
  hourCounts.sort((a, b) => a - b);
  const medianHour = hourCounts[Math.floor(hourCounts.length / 2)];
  const h = medianHour % 12 || 12;
  const typicalTime = `~${h}${medianHour >= 12 ? "PM" : "AM"} UTC`;
  const topGames = Object.entries(gameCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([g]) => g);
  const avgHours = streamHistory?.length > 0 ? Math.round((totalSec / streamHistory.length / 3600) * 10) / 10 : 3;

  return { topDays, typicalTime, topGames, avgHours, total: streamHistory?.length ?? 0, source };
}

export default function FriendDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: friend, mutate } = useSWR(`/api/friends/${id}`, fetcher);
  const { data: collabData, mutate: mutateCollabs } = useSWR(`/api/friends/${id}/collabs`, fetcher);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  if (!friend) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  if (friend.error) return <div className="text-destructive">Friend not found</div>;

  async function saveNotes() {
    await fetch(`/api/friends/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes }) });
    mutate();
    setEditingNotes(false);
  }

  async function refreshHistory() {
    setRefreshing(true);
    await Promise.all([
      fetch(`/api/friends/${id}/history/stream`, { method: "POST" }),
      fetch(`/api/friends/${id}/schedule`, { method: "POST" }),
      fetch(`/api/friends/${id}/collabs`, { method: "POST" }),
    ]);
    mutate();
    mutateCollabs();
    setRefreshing(false);
  }

  async function removeFriend() {
    if (!confirm(`Remove ${friend.displayName}?`)) return;
    await fetch(`/api/friends/${id}`, { method: "DELETE" });
    router.push("/friends");
  }

  const pattern = getStreamingPattern(friend.streamHistory, friend.scheduleSegments);
  const upcomingSegments = friend.scheduleSegments?.filter((s: any) => new Date(s.endTime) > new Date()) ?? [];
  const collabPartners = collabData?.summary?.partners ?? [];
  const collabSignals = collabData?.signals ?? [];
  const accentColor = friend.channelColor || "#7c3aed";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/friends">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" />Back</Button>
        </Link>
      </div>

      {/* Profile header */}
      <Card style={{ borderColor: accentColor + "60" }}>
        <div className="h-1 rounded-t-lg" style={{ backgroundColor: accentColor }} />
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20" style={{ outline: `2px solid ${accentColor}40`, outlineOffset: "2px" }}>
              <AvatarImage src={friend.avatarUrl} />
              <AvatarFallback className="text-2xl">{friend.displayName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{friend.displayName}</h1>
                {friend.isMe && <Badge style={{ backgroundColor: accentColor, color: "#fff", border: "none" }}>You</Badge>}
              </div>
              <p className="text-muted-foreground">@{friend.username}</p>
              {collabPartners.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Collaborated with: {collabPartners.slice(0, 3).map((p: any) => p.name).join(", ")}
                  {collabPartners.length > 3 && ` +${collabPartners.length - 3} more`}
                </p>
              )}
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
        {/* Streaming pattern */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Streaming Pattern
              <Badge variant={pattern.source === "estimated" ? "outline" : "success"} className="text-xs ml-auto">
                {pattern.source === "estimated" ? "estimated" : pattern.source === "schedule" ? "from schedule" : pattern.source === "mixed" ? `${pattern.total} streams + schedule` : `${pattern.total} streams`}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Typical streaming days</p>
                <div className="flex gap-1">
                  {DAYS.map((d) => (
                    <span key={d} className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={pattern.topDays.includes(d)
                        ? { backgroundColor: accentColor, color: "#fff" }
                        : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
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
                <p className="text-xs text-muted-foreground italic">No game data — <button className="underline" onClick={refreshHistory}>refresh</button></p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Collab Analysis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users2 className="h-4 w-4" />
              Collab Partners
              <Badge variant="secondary" className="text-xs ml-auto">
                {collabSignals.length} signals
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {collabPartners.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p className="text-sm">No collab signals detected yet</p>
                <p className="text-xs mt-1">Refresh to scan VOD titles for mentions</p>
              </div>
            ) : (
              <div className="space-y-2">
                {collabPartners.slice(0, 6).map((p: any) => (
                  <div key={p.login} className="flex items-center gap-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{p.name}</span>
                        <Badge
                          variant={p.highConfidenceCount > 0 ? "success" : "secondary"}
                          className="text-[10px] px-1 py-0"
                        >
                          {p.highConfidenceCount > 0 ? "confirmed" : "possible"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.count}× detected · last {format(new Date(p.lastSeen), "MMM d, yyyy")}
                      </p>
                    </div>
                    <span className="text-[10px] bg-muted px-1 rounded shrink-0">VOD</span>
                  </div>
                ))}
                {collabPartners.length > 6 && (
                  <p className="text-xs text-muted-foreground pt-1">+{collabPartners.length - 6} more partners detected</p>
                )}
              </div>
            )}
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
                {friend.streamHistory.slice(0, 10).map((s: any) => {
                  // Highlight VOD titles that contain collab signals
                  const hasCollabMention = collabSignals.some((sig: any) => sig.evidence === s.title);
                  return (
                    <div key={s.id} className={`text-xs border-l-2 pl-2 py-0.5 ${hasCollabMention ? "border-primary" : "border-muted"}`}>
                      <p className="font-medium truncate">{s.title}</p>
                      <p className="text-muted-foreground">
                        {format(new Date(s.startTime), "EEE MMM d, h:mm a")}
                        {s.durationSec ? ` · ${Math.round(s.durationSec / 3600 * 10) / 10}h` : ""}
                        {s.gameName ? ` · ${s.gameName}` : ""}
                        {hasCollabMention && <span className="ml-1 text-primary font-medium">collab</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes + schedule */}
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
        </div>
      </div>
    </div>
  );
}
