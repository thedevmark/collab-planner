"use client";

import { useState, useEffect, Suspense } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { format, addHours, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Sparkles, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import type { TimeSuggestion, GameSuggestion } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function toLocalDatetimeValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

  const [suggestingTimes, setSuggestingTimes] = useState(false);
  const [timeSuggestions, setTimeSuggestions] = useState<TimeSuggestion[]>([]);

  const [suggestingGames, setSuggestingGames] = useState(false);
  const [gameSuggestions, setGameSuggestions] = useState<GameSuggestion[]>([]);

  const [gameSearch, setGameSearch] = useState("");
  const { data: gameResults = [] } = useSWR(
    gameSearch.length >= 2 ? `/api/twitch/categories?q=${encodeURIComponent(gameSearch)}` : null,
    fetcher
  );

  // Always include "me" + pre-select friend from URL
  useEffect(() => {
    const ids: number[] = meFriend ? [meFriend.id] : [];
    const friendId = searchParams.get("friendId");
    if (friendId) ids.push(parseInt(friendId));
    if (ids.length > 0) setSelectedFriendIds(ids);
  }, [meFriend?.id, searchParams]);

  // All IDs sent to AI always include me
  const aiIds = meFriend
    ? [...new Set([meFriend.id, ...selectedFriendIds])]
    : selectedFriendIds;

  function toggleFriend(id: number) {
    if (meFriend && id === meFriend.id) return; // me is always selected
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function suggestTimes() {
    if (aiIds.length === 0) return;
    setSuggestingTimes(true);
    try {
      const res = await fetch("/api/ai/suggest-times", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendIds: aiIds }),
      });
      const data = await res.json();
      setTimeSuggestions(data.suggestions ?? []);
    } finally {
      setSuggestingTimes(false);
    }
  }

  async function suggestGames() {
    if (aiIds.length === 0) return;
    setSuggestingGames(true);
    try {
      const res = await fetch("/api/ai/suggest-games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendIds: aiIds }),
      });
      const data = await res.json();
      setGameSuggestions(data.suggestions ?? []);
    } finally {
      setSuggestingGames(false);
    }
  }

  function applySuggestion(s: TimeSuggestion) {
    setStartTime(toLocalDatetimeValue(new Date(s.start)));
    setEndTime(toLocalDatetimeValue(new Date(s.end)));
    setTimeSuggestions([]);
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/calendar">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">New Collab Event</h1>
      </div>

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
              <Label htmlFor="start">Start Time *</Label>
              <Input
                id="start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  if (e.target.value) {
                    const newEnd = addHours(new Date(e.target.value), 3);
                    setEndTime(toLocalDatetimeValue(newEnd));
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End Time *</Label>
              <Input
                id="end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
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

          {/* Game field */}
          <div className="space-y-2">
            <Label htmlFor="game">Game</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="game"
                  placeholder="Search Twitch categories..."
                  value={gameSearch || gameName}
                  onChange={(e) => { setGameSearch(e.target.value); setGameName(e.target.value); }}
                />
                {gameResults.length > 0 && gameSearch && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 border rounded-md bg-background shadow-md">
                    {gameResults.slice(0, 6).map((g: any) => (
                      <button
                        key={g.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
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
                disabled={suggestingGames || aiIds.length === 0}
              >
                {suggestingGames ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                AI Suggest
              </Button>
            </div>
            {gameSuggestions.length > 0 && (
              <div className="border rounded-md p-3 space-y-2 bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground">AI Game Suggestions:</p>
                {gameSuggestions.map((g) => (
                  <button
                    key={g.name}
                    onClick={() => { setGameName(g.name); setGameSuggestions([]); }}
                    className="w-full text-left p-2 rounded hover:bg-accent text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{g.name}</span>
                      {g.isTrending && <Badge variant="secondary" className="text-xs">Trending</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{g.reason}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Friends */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Invite Friends</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={suggestTimes}
              disabled={suggestingTimes || aiIds.length === 0}
            >
              {suggestingTimes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Suggest Times
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* "Me" card — always selected, non-toggleable */}
          {meFriend && (
            <div className="flex items-center gap-2 p-2 rounded-md border border-muted bg-muted/20 opacity-60 mb-1">
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
                      selected ? "border-primary bg-primary/10" : "hover:bg-accent"
                    }`}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={f.avatarUrl} />
                      <AvatarFallback className="text-xs">{f.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">{f.displayName}</span>
                    {selected && <Plus className="h-4 w-4 text-primary ml-auto shrink-0 rotate-45" />}
                  </button>
                );
              })}
            </div>
          )}

          {timeSuggestions.length > 0 && (
            <div className="border rounded-md p-3 space-y-2 bg-muted/30 mt-3">
              <p className="text-xs font-medium text-muted-foreground">AI Time Suggestions:</p>
              {timeSuggestions.map((s) => (
                <button
                  key={s.rank}
                  onClick={() => applySuggestion(s)}
                  className="w-full text-left p-3 rounded-md border hover:bg-accent text-sm space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">#{s.rank}</Badge>
                    <span className="font-medium">
                      {format(new Date(s.start), "EEE, MMM d h:mm a")} –{" "}
                      {format(new Date(s.end), "h:mm a")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    Available: {s.participants.join(", ")}
                  </p>
                </button>
              ))}
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
  );
}

export default function NewEventPage() {
  return (
    <Suspense>
      <NewEventForm />
    </Suspense>
  );
}
