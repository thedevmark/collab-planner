"use client";

import { startTransition, useState, useEffect, useMemo, useRef, Suspense } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { addDays, addHours, formatDistanceToNowStrict } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, Check, Zap, Link2, Sparkles } from "lucide-react";
import Link from "next/link";
import { InviteDialog } from "@/components/InviteDialog";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { AvailabilityMatrix } from "@/components/events/AvailabilityMatrix";
import { MessageBlock } from "@/components/events/MessageBlock";
import { StreamPatternPanel } from "@/components/events/StreamPatternPanel";
import { getPlannerTopSlots } from "@/lib/scheduling/planner";
import type { ScoredSlot } from "@/lib/scheduling/overlap";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

function NewEventForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: friends = [], mutate: mutateFriends } = useSWR("/api/friends", fetcher);
  const { data: profile } = useSWR("/api/profile/onboarding", fetcher);

  const meFriend = friends.find((f: any) => f.isMe);
  const meFriendId = meFriend?.id;
  const otherFriends = friends
    .filter((f: any) => !f.isMe)
    .sort((a: any, b: any) => {
      if (a.isFavorite !== b.isFavorite) return Number(b.isFavorite) - Number(a.isFavorite);
      return a.displayName.localeCompare(b.displayName);
    });

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
  const [invitePrefill, setInvitePrefill] = useState<any | null>(null);
  const importedInviteTokenRef = useRef<string | null>(null);

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
    const ids: number[] = meFriendId ? [meFriendId] : [];
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
  }, [meFriendId, searchParams]);

  useEffect(() => {
    const fromInvite = searchParams.get("fromInvite");
    if (!fromInvite) {
      setInvitePrefill(null);
      importedInviteTokenRef.current = null;
      return;
    }

    fetch(`/api/invites/${fromInvite}`)
      .then((r) => r.json())
      .then(({ valid, expired, invite }) => {
        if (!valid || expired || !invite) return;

        setInvitePrefill(invite);

        if (invite.title) setTitle(invite.title);
        if (invite.gameName) setGameName(invite.gameName);
        if (invite.description) setDescription(invite.description);

        setInviteBanner({
          creatorDisplayName: invite.creatorDisplayName,
          creatorAvatarUrl: invite.creatorAvatarUrl,
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("fromInvite")]);

  useEffect(() => {
    if (!invitePrefill || friends.length === 0) return;

    const inviteUsernames = Array.from(
      new Set(
        [
          ...(invitePrefill.recipients?.map((recipient: any) => recipient.username) ??
            invitePrefill.participantUsernames ??
            []),
          invitePrefill.creatorUsername,
        ]
          .filter(Boolean)
          .map((username: string) => username.toLowerCase())
      )
    );

    if (inviteUsernames.length === 0) return;

    const matched = friends
      .filter(
        (friend: any) =>
          !friend.isMe && inviteUsernames.includes(friend.username?.toLowerCase())
      )
      .map((friend: any) => friend.id);

    if (matched.length > 0) {
      setSelectedFriendIds((prev: number[]) => {
        const ids = [...prev];
        for (const id of matched) {
          if (!ids.includes(id)) ids.push(id);
        }
        return ids;
      });
    }

    if (importedInviteTokenRef.current === invitePrefill.token) return;
    importedInviteTokenRef.current = invitePrefill.token;

    const existingUsernames = new Set(
      friends
        .filter((friend: any) => !friend.isMe)
        .map((friend: any) => friend.username?.toLowerCase())
    );
    const missingUsernames = inviteUsernames.filter(
      (username: string) => !existingUsernames.has(username)
    );

    if (missingUsernames.length === 0) return;

    Promise.allSettled(
      missingUsernames.map((username: string) =>
        fetch("/api/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, isSuggested: true }),
        })
      )
    )
      .then(() => mutateFriends())
      .catch(() => {});
  }, [invitePrefill, friends, mutateFriends]);

  useEffect(() => {
    const addFriend = searchParams.get("addFriend");
    if (!addFriend || friends.length === 0) return;

    const existing = friends.find(
      (f: any) => f.username?.toLowerCase() === addFriend.toLowerCase()
    );
    if (existing && !existing.isMe) {
      setSelectedFriendIds((prev) =>
        prev.includes(existing.id) ? prev : [...prev, existing.id]
      );
    } else if (!existing) {
      fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: addFriend, isSuggested: false }),
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("addFriend"), friends.length > 0]);

  const aiIds = useMemo(
    () => (meFriendId ? [...new Set([meFriendId, ...selectedFriendIds])] : selectedFriendIds),
    [meFriendId, selectedFriendIds]
  );

  const selectedNonMe = selectedFriendIds.filter((id) => meFriend?.id !== id);
  const plannerTimezone =
    profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const currentDurationMs = Math.max(
    60 * 60 * 1000,
    new Date(endTime).getTime() - new Date(startTime).getTime() || 3 * 60 * 60 * 1000
  );
  const plannerFrom = useMemo(() => {
    const anchor = startTime ? new Date(startTime) : new Date();
    if (Number.isNaN(anchor.getTime())) return new Date();
    const dayStart = new Date(anchor);
    dayStart.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return dayStart < now ? now : dayStart;
  }, [startTime]);
  const plannerTo = useMemo(() => addDays(plannerFrom, 7), [plannerFrom]);
  const plannerFriends = useMemo(
    () => friends.filter((friend: any) => aiIds.includes(friend.id)),
    [friends, aiIds]
  );
  const plannerTopSlots = useMemo(
    () => getPlannerTopSlots(plannerFriends, plannerFrom, plannerTo, 5),
    [plannerFriends, plannerFrom, plannerTo]
  );
  const selectedMessageParticipants = useMemo(
    () =>
      friends
        .filter((friend: any) => selectedNonMe.includes(friend.id))
        .map((friend: any) => ({
          displayName: friend.displayName,
          twitchUsername: friend.username,
        })),
    [friends, selectedNonMe]
  );
  const suggestionFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: plannerTimezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    [plannerTimezone]
  );

  function toggleFriend(id: number) {
    if (meFriend && id === meFriend.id) return;
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function suggestTimes() {
    if (aiIds.length === 0) return;
    setSuggestingTimes(true);
    startTransition(() => {
      const suggestions = plannerTopSlots.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        combinedScore: Math.round(slot.combinedScore * 100),
        confidence: slot.confidence,
        displayStart: suggestionFormatter.format(slot.start),
        displayEnd: suggestionFormatter.format(slot.end),
        timezone: plannerTimezone,
        windowHours: Math.round(((slot.end.getTime() - slot.start.getTime()) / 3600000) * 10) / 10,
        friendScores: slot.friendScores.map((friendScore) => ({
          friendId: friendScore.friendId,
          displayName: friendScore.displayName,
          probability: Math.round(friendScore.score * 100),
        })),
      }));
      setTimeSuggestions(suggestions);
      setTimeSuggestEmpty(suggestions.length === 0);
      setTimeSuggestTimezone(plannerTimezone);
      setAppliedSlot(null);
      setSuggestingTimes(false);
    });
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

  function applyMatrixSlot(slot: ScoredSlot) {
    const start = snapToQuarter(new Date(slot.start));
    const end = snapToQuarter(new Date(start.getTime() + currentDurationMs));
    setStartTime(toLocalDatetimeValue(start));
    setEndTime(toLocalDatetimeValue(end));
    setTimeSuggestions([]);
    setTimeSuggestEmpty(false);
    setAppliedSlot(null);
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
          fromInviteToken: searchParams.get("fromInvite") || undefined,
        }),
      });
      const event = await res.json();
      if (!res.ok) throw new Error(event.error);
      router.push(`/events/${event.id}`);
    } finally {
      setSaving(false);
    }
  }

  const hasSelection = selectedNonMe.length > 0;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link href="/calendar">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Plan a session</h1>
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

      {/* ── 1. Choose people ─────────────────────────────────────────────
          Who-first. Every downstream panel (pattern overlap, workable
          windows, suggest times, share link) depends on this. Moved to
          the top so users don't scroll past Event Details to discover
          the scheduling tools need a selection. */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Choose People</CardTitle>
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

          {/* Person grid — 2/3/4 columns depending on viewport so the
              cards aren't wasted on a ~200px slab at wide widths. `me`
              is pinned first as a muted card to keep the "who's in
              this session" mental model visible. */}
          {otherFriends.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <Link href="/friends" className="underline">Add people</Link> to invite them
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {meFriend && (
                <div className="flex items-center gap-2 p-2 rounded-md border border-muted bg-muted/20 opacity-60">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={meFriend.avatarUrl} />
                    <AvatarFallback className="text-xs">{meFriend.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate">{meFriend.displayName}</span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">you</span>
                </div>
              )}
              {otherFriends.map((f: any) => {
                const selected = selectedFriendIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleFriend(f.id)}
                    className={`flex items-center gap-2 p-2 rounded-md border text-left transition-colors ${
                      selected ? "border-primary/40 bg-primary/10" : "hover:bg-accent"
                    }`}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={f.avatarUrl} />
                      <AvatarFallback className="text-xs">{f.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">{f.displayName}</span>
                    <div className="ml-auto flex items-center gap-1.5 shrink-0">
                      {f.isFavorite && (
                        <Badge variant="secondary" className="text-[10px]">
                          Favorite
                        </Badge>
                      )}
                      {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 2. Stream Pattern Overlap + Workable Windows ────────────────
          Stacked full-width rather than a 320px sticky sidebar so the
          week grid gets the whole row and the pattern panel doesn't have
          a stack of narrow 7-day strips. */}
      {hasSelection && (
        <StreamPatternPanel
          selectedFriendIds={aiIds}
          allFriends={friends}
          sticky={false}
        />
      )}

      {hasSelection && (
        <AvailabilityMatrix
          friends={friends}
          selectedFriendIds={aiIds}
          timezone={plannerTimezone}
          anchorStart={startTime}
          selectedStartTime={startTime}
          durationMs={currentDurationMs}
          onApplySlot={applyMatrixSlot}
        />
      )}

      {/* ── 3. Event Details ────────────────────────────────────────────
          Moved below the planning tools. Users know WHO and WHEN before
          they polish the title / description. */}
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

      {hasSelection && (
        <MessageBlock
          title={title}
          gameName={gameName || undefined}
          startTime={new Date(startTime)}
          endTime={new Date(endTime)}
          participants={selectedMessageParticipants}
          timezone={plannerTimezone}
        />
      )}

      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={saving || !title || !startTime || !endTime}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Session
        </Button>
        <Link href="/calendar">
          <Button variant="outline">Cancel</Button>
        </Link>
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
