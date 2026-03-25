"use client";

import { useState, useEffect, Suspense } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { addHours, formatDistanceToNowStrict } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, Check, TrendingUp, Zap, Link2, Sparkles } from "lucide-react";
import Link from "next/link";
import { InviteDialog } from "@/components/InviteDialog";
import { DateTimePicker } from "@/components/ui/date-time-picker";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const FALLBACK_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toLocalDatetimeValue(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

function snapToQuarter(date: Date): Date {
  const ms = 15 * 60 * 1000;
  return new Date(Math.round(date.getTime() / ms) * ms);
}

function getFriendPattern(friend: any) {
  const history = friend.streamHistory ?? [];
  const segments = friend.scheduleSegments ?? [];
  const dayCounts: Record<number, number> = {};
  const hours: number[] = [];

  for (const s of history) {
    const d = new Date(s.startTime).getDay();
    dayCounts[d] = (dayCounts[d] ?? 0) + 1;
    hours.push(new Date(s.startTime).getHours());
  }
  for (const s of segments) {
    const d = new Date(s.startTime).getDay();
    dayCounts[d] = (dayCounts[d] ?? 0) + 0.5;
    hours.push(new Date(s.startTime).getHours());
  }

  if (hours.length === 0) return null;

  const topDayIndices = Object.entries(dayCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([d]) => parseInt(d));

  hours.sort((a, b) => a - b);
  const medHour = hours[Math.floor(hours.length / 2)];
  const h = medHour % 12 === 0 ? 12 : medHour % 12;
  const typicalTime = `~${h}${medHour >= 12 ? "PM" : "AM"}`;

  return { topDayIndices, typicalTime };
}

function StreamPatternPanel({
  selectedFriendIds,
  allFriends,
}: {
  selectedFriendIds: number[];
  allFriends: any[];
}) {
  const selected = allFriends.filter((f) => selectedFriendIds.includes(f.id));
  if (selected.length === 0) return null;

  const patterns = selected.map((f) => {
    const color = f.channelColor || FALLBACK_COLORS[
      allFriends.filter((x) => !x.isMe).findIndex((x) => x.id === f.id) % FALLBACK_COLORS.length
    ];
    return { friend: f, color, pattern: getFriendPattern(f) };
  });

  const patternsWithData = patterns.filter((p) => p.pattern);
  const overlapDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => {
    if (patternsWithData.length === 0) return false;
    const matches = patternsWithData.filter((p) => p.pattern!.topDayIndices.includes(d)).length;
    return matches >= Math.max(2, Math.ceil(patternsWithData.length * 0.6));
  });

  return (
    <Card className="sticky top-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Stream Pattern Overlap
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {patterns.map(({ friend, color, pattern }) => (
          <div key={friend.id} className="space-y-1.5 animate-fade-in-up">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={friend.avatarUrl} />
                <AvatarFallback className="text-[10px]">{friend.displayName[0]}</AvatarFallback>
              </Avatar>
              <span className="text-xs font-semibold truncate" style={{ color }}>
                {friend.isMe ? "You" : friend.displayName}
              </span>
              {pattern && (
                <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{pattern.typicalTime}</span>
              )}
            </div>

            {pattern ? (
              <div className="flex gap-0.5">
                {DAYS.map((d, i) => {
                  const active = pattern.topDayIndices.includes(i);
                  const overlap = overlapDays.includes(i);
                  return (
                    <span
                      key={d}
                      className="flex-1 text-center text-[10px] py-0.5 rounded font-medium"
                      style={
                        active
                          ? {
                              backgroundColor: overlap ? color : color + "55",
                              color: overlap ? "#fff" : color,
                              outline: overlap ? `1px solid ${color}` : "none",
                            }
                          : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                      }
                    >
                      {d}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground italic">Not enough data yet</p>
            )}
          </div>
        ))}

        {overlapDays.length > 0 && patterns.length > 1 && (
          <div className="pt-1 border-t border-border">
            <p className="text-[10px] text-muted-foreground mb-1">Best overlap days</p>
            <div className="flex gap-1 flex-wrap">
              {overlapDays.map((d) => (
                <Badge key={d} variant="secondary" className="text-[10px] px-2 py-0.5">
                  {FULL_DAYS[d]}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {patterns.length > 1 && overlapDays.length === 0 && patternsWithData.length > 1 && (
          <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-border">
            No consistent overlap — try Suggest Times for the best fit.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function NewEventForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: friends = [] } = useSWR("/api/friends", fetcher);

  const meFriend = friends.find((f: any) => f.isMe);
  const otherFriends = friends.filter((f: any) => !f.isMe);

  const now = new Date();
  const defaultStart = searchParams.get("startTime")
    ? new Date(searchParams.get("startTime")!)
    : addHours(now, 1);

  const [title, setTitle] = useState("Collab Stream");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(toLocalDatetimeValue(defaultStart));
  const [endTime, setEndTime] = useState(toLocalDatetimeValue(addHours(defaultStart, 3)));
  const [gameName, setGameName] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [inviteBanner, setInviteBanner] = useState<{ creatorDisplayName: string; creatorAvatarUrl: string } | null>(null);

  const [suggestingTimes, setSuggestingTimes] = useState(false);
  const [timeSuggestions, setTimeSuggestions] = useState<any[]>([]);
  const [timeSuggestTimezone, setTimeSuggestTimezone] = useState("UTC");
  const [timeSuggestEmpty, setTimeSuggestEmpty] = useState(false);
  const [appliedSlot, setAppliedSlot] = useState<number | null>(null);

  const [suggestingGames, setSuggestingGames] = useState(false);
  const [gameSuggestions, setGameSuggestions] = useState<any[]>([]);
  const [gameSuggestEmpty, setGameSuggestEmpty] = useState(false);

  const [gameSearch, setGameSearch] = useState("");
  const { data: gameResults = [] } = useSWR(
    gameSearch.length >= 2 ? `/api/twitch/categories?q=${encodeURIComponent(gameSearch)}` : null,
    fetcher
  );

  useEffect(() => {
    const ids: number[] = meFriend ? [meFriend.id] : [];
    const friendId = searchParams.get("friendId");
    if (friendId) ids.push(parseInt(friendId));
    const friendIds = searchParams.get("friendIds");
    if (friendIds) {
      for (const raw of friendIds.split(",")) {
        const n = parseInt(raw.trim());
        if (!isNaN(n) && !ids.includes(n)) ids.push(n);
      }
    }
    if (ids.length > 0) setSelectedFriendIds(ids);
  }, [meFriend?.id, searchParams]);

  useEffect(() => {
    const fromInvite = searchParams.get("fromInvite");
    if (!fromInvite || friends.length === 0) return;

    fetch(`/api/invites/${fromInvite}`)
      .then((r) => r.json())
      .then(({ valid, expired, invite }) => {
        if (!valid || expired || !invite) return;

        if (invite.title) setTitle(invite.title);
        if (invite.gameName) setGameName(invite.gameName);
        if (invite.description) setDescription(invite.description);

        const matched = friends
          .filter((f: any) => !f.isMe && invite.participantUsernames?.includes(f.username))
          .map((f: any) => f.id);

        if (matched.length > 0) {
          setSelectedFriendIds((prev: number[]) => {
            const ids = [...prev];
            for (const id of matched) {
              if (!ids.includes(id)) ids.push(id);
            }
            return ids;
          });
        }

        setInviteBanner({
          creatorDisplayName: invite.creatorDisplayName,
          creatorAvatarUrl: invite.creatorAvatarUrl,
        });

        fetch(`/api/invites/${fromInvite}`, { method: "PATCH" });

        // Auto-suggest invite creator as a friend
        if (invite.creatorUsername) {
          fetch("/api/friends", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: invite.creatorUsername, isSuggested: true }),
          }).catch(() => {}); // fire-and-forget, non-critical
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("fromInvite"), friends.length > 0]);

  const aiIds = meFriend
    ? [...new Set([meFriend.id, ...selectedFriendIds])]
    : selectedFriendIds;

  const selectedNonMe = selectedFriendIds.filter((id) => meFriend?.id !== id);

  function toggleFriend(id: number) {
    if (meFriend && id === meFriend.id) return;
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function suggestTimes() {
    if (aiIds.length === 0) return;
    setSuggestingTimes(true);
    setTimeSuggestions([]);
    setTimeSuggestEmpty(false);
    try {
      const res = await fetch("/api/suggest-times", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendIds: aiIds }),
      });
      const data = await res.json();
      const suggestions = data.suggestions ?? [];
      setTimeSuggestions(suggestions);
      setTimeSuggestEmpty(suggestions.length === 0);
      if (data.timezone) setTimeSuggestTimezone(data.timezone);
    } finally {
      setSuggestingTimes(false);
    }
  }

  function applyTimeSuggestion(suggestion: any, index: number) {
    const start = snapToQuarter(new Date(suggestion.start));
    const end = snapToQuarter(new Date(suggestion.end));
    setStartTime(toLocalDatetimeValue(start));
    setEndTime(toLocalDatetimeValue(end));
    setAppliedSlot(index);
    setTimeout(() => {
      setTimeSuggestions([]);
      setAppliedSlot(null);
    }, 800);
  }

  async function suggestGames() {
    if (selectedNonMe.length === 0) return;
    setSuggestingGames(true);
    setGameSearch("");
    setGameSuggestEmpty(false);
    try {
      const res = await fetch("/api/suggest-games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendIds: aiIds }),
      });
      const data = await res.json();
      const games = data.games ?? [];
      setGameSuggestions(games);
      setGameSuggestEmpty(games.length === 0);
    } finally {
      setSuggestingGames(false);
    }
  }

  async function handleSubmit() {
    if (!title || !startTime || !endTime) return;
    setSaving(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          gameName,
          participantIds: selectedFriendIds,
        }),
      });
      const event = await res.json();
      if (!res.ok) throw new Error(event.error);
      router.push(`/events/${event.id}`);
    } finally {
      setSaving(false);
    }
  }

  const showPanel = selectedNonMe.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/calendar">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">New Collab Event</h1>
      </div>

      {inviteBanner && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
          <Avatar className="h-6 w-6">
            <AvatarImage src={inviteBanner.creatorAvatarUrl} />
            <AvatarFallback>{inviteBanner.creatorDisplayName[0]}</AvatarFallback>
          </Avatar>
          <span>
            Planning from <strong>{inviteBanner.creatorDisplayName}</strong>&apos;s invite
          </span>
        </div>
      )}

      <div className={`gap-6 max-w-5xl ${showPanel ? "grid grid-cols-[minmax(0,1fr)_320px]" : "flex flex-col max-w-2xl"}`}>
        {/* Left column */}
        <div className="space-y-6 min-w-0">
          <Card>
            <CardHeader><CardTitle className="text-base">Event Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g. Weekend Gaming Session"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time *</Label>
                  <DateTimePicker
                    value={startTime}
                    onChange={(v) => {
                      setStartTime(v);
                      if (v) setEndTime(toLocalDatetimeValue(addHours(new Date(v), 3)));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time *</Label>
                  <DateTimePicker value={endTime} onChange={setEndTime} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What's the plan?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Game / Genre */}
              <div className="space-y-2">
                <Label htmlFor="game">Game or Genre</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="game"
                      placeholder="e.g. Minecraft, horror games, co-op shooters..."
                      value={gameName}
                      onChange={(e) => { setGameName(e.target.value); setGameSearch(e.target.value); }}
                    />
                    {gameResults.length > 0 && gameSearch && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-1 border rounded-md bg-background shadow-md">
                        {gameResults.slice(0, 6).map((g: any) => (
                          <button
                            key={g.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                            onClick={() => { setGameName(g.name); setGameSearch(""); }}
                          >
                            {g.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={suggestGames}
                    disabled={suggestingGames || selectedNonMe.length === 0}
                    title={selectedNonMe.length === 0 ? "Select friends to get game suggestions" : "Suggest games based on stream history"}
                  >
                    {suggestingGames ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Suggest
                  </Button>
                </div>
                {gameSuggestions.length > 0 && (
                  <div className="border rounded-md p-3 space-y-1 bg-muted/30 animate-in fade-in slide-in-from-top-1 duration-200">
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Games your group has streamed:
                    </p>
                    {gameSuggestions.slice(0, 8).map((g) => (
                      <button
                        key={g.name}
                        onClick={() => { setGameName(g.name); setGameSuggestions([]); setGameSuggestEmpty(false); }}
                        className="w-full text-left p-2 rounded hover:bg-accent text-sm transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{g.name}</span>
                          <Badge
                            variant={
                              g.bucket === "everyone"
                                ? "success"
                                : g.bucket === "group"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-xs capitalize"
                          >
                            {g.bucket === "everyone" ? "everyone plays" : g.bucket}
                          </Badge>
                          {g.friendCount > 1 && (
                            <Badge variant="secondary" className="text-xs">{g.friendCount} friends</Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {Math.round(g.score * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {g.totalSessions} streams · {g.recentFriendCount} active recently · last seen{" "}
                          {formatDistanceToNowStrict(new Date(g.lastPlayedAt), { addSuffix: true })}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {gameSuggestEmpty && !suggestingGames && (
                  <p className="text-xs text-muted-foreground px-1">
                    No shared game history yet — add friends and refresh their data first.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Friends */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Invite Friends</CardTitle>
              <div className="flex items-center gap-2">
                <InviteDialog friends={friends} defaultFriendIds={selectedNonMe}>
                  <Button variant="outline" size="sm">
                    <Link2 className="h-4 w-4" />
                    Share Link
                  </Button>
                </InviteDialog>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={suggestTimes}
                  disabled={suggestingTimes || aiIds.length === 0}
                  title={aiIds.length === 0 ? "Select friends to suggest times" : "Analyze stream patterns"}
                >
                  {suggestingTimes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {suggestingTimes ? "Analyzing…" : "Suggest Times"}
                </Button>
              </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {timeSuggestions.length > 0 && (
                <div className="border rounded-md p-3 space-y-1 bg-muted/30 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    Best windows based on stream history ({timeSuggestTimezone}):
                  </p>
                  {timeSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => applyTimeSuggestion(s, i)}
                      className={`w-full text-left p-2 rounded text-sm transition-all ${
                        appliedSlot === i
                          ? "bg-primary/20 border border-primary/40 scale-[0.99]"
                          : "hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {appliedSlot === i
                          ? <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                          : <span className="text-xs text-muted-foreground w-3.5 shrink-0">{i + 1}.</span>
                        }
                        <span className="font-medium">{s.displayStart}</span>
                        <Badge variant={s.confidence === "high" ? "success" : s.confidence === "medium" ? "secondary" : "outline"} className="text-[10px] capitalize">
                          {s.confidence}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto font-medium">{s.combinedScore}% match</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                        through {s.displayEnd} · {s.windowHours}h window
                      </p>
                      {s.friendScores?.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-1 ml-5">
                          {s.friendScores.map((f: any) => (
                            <span key={f.friendId} className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                              {f.displayName} {f.probability}%
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {timeSuggestEmpty && !suggestingTimes && (
                <p className="text-xs text-muted-foreground px-1 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Not enough stream history yet — refresh friend data and try again.
                </p>
              )}
              {meFriend && (
                <div className="flex items-center gap-2 p-2 rounded-md border border-muted bg-muted/20 opacity-60">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={meFriend.avatarUrl} />
                    <AvatarFallback className="text-xs">{meFriend.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate">{meFriend.displayName}</span>
                  <span className="text-xs text-muted-foreground ml-auto">you</span>
                </div>
              )}

              {otherFriends.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <Link href="/friends" className="underline">Add friends</Link> to invite them
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {otherFriends.map((f: any) => {
                    const selected = selectedFriendIds.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => toggleFriend(f.id)}
                        className={`flex items-center gap-2 p-2 rounded-md border text-left transition-colors ${
                          selected ? "border-zinc-600 bg-zinc-800/40" : "hover:bg-accent"
                        }`}
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={f.avatarUrl} />
                          <AvatarFallback className="text-xs">{f.displayName[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{f.displayName}</span>
                        {selected && <Check className="h-3.5 w-3.5 text-zinc-300 ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleSubmit} disabled={saving || !title || !startTime || !endTime}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Event
            </Button>
            <Link href="/calendar">
              <Button variant="outline">Cancel</Button>
            </Link>
          </div>
        </div>

        {/* Right column — pattern panel */}
        {showPanel && (
          <StreamPatternPanel
            selectedFriendIds={aiIds}
            allFriends={friends}
          />
        )}
      </div>
    </div>
  );
}

export default function NewEventPage() {
  return (
    <Suspense>
      <NewEventForm />
    </Suspense>
  );
}
