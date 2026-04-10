"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, Search, Zap } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Suggestion {
  start: string;
  end: string;
  combinedScore: number;
  confidence: string;
  displayStart: string;
  displayEnd: string;
  timezone: string;
  windowHours: number;
  friendScores: {
    friendId: number;
    displayName: string;
    probability: number;
  }[];
}

/**
 * "Find Time" calendar sub-view.
 *
 * Lets the user pick which friends to check for overlap, fires the
 * suggest-times API, and renders ranked time slots. Each slot has a
 * "Plan this" action that deep-links into /events/new with the time
 * pre-filled.
 */
export default function FindTimeView() {
  const { data: friends = [] } = useSWR("/api/friends", fetcher);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [timezone, setTimezone] = useState("UTC");

  const nonMe = friends.filter((f: any) => !f.isMe && !f.isSuggested);

  function toggle(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(nonMe.map((f: any) => f.id)));
  }

  function clearAll() {
    setSelectedIds(new Set());
    setSuggestions([]);
    setEmpty(false);
  }

  async function findTime() {
    if (selectedIds.size === 0) return;
    setLoading(true);
    setSuggestions([]);
    setEmpty(false);
    try {
      const res = await fetch("/api/suggest-times", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      const list: Suggestion[] = data.suggestions ?? [];
      setSuggestions(list);
      setTimezone(list[0]?.timezone ?? "UTC");
      if (list.length === 0) setEmpty(true);
    } catch {
      setEmpty(true);
    } finally {
      setLoading(false);
    }
  }

  function buildPlanLink(slot: Suggestion) {
    const params = new URLSearchParams({
      start: slot.start,
      end: slot.end,
    });
    for (const id of selectedIds) {
      params.append("friendId", String(id));
    }
    return `/events/new?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Select people</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
                All
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {nonMe.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add people first, then come back here.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {nonMe.map((friend: any) => {
                const selected = selectedIds.has(friend.id);
                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => toggle(friend.id)}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={friend.avatarUrl} />
                      <AvatarFallback className="text-xs">{friend.displayName?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="truncate flex-1">{friend.displayName}</span>
                    {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <Button
              onClick={() => { void findTime(); }}
              disabled={loading || selectedIds.size === 0}
              className="gap-1.5"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Analyzing…" : `Find time for ${selectedIds.size || "…"}`}
            </Button>
            {selectedIds.size > 0 && !loading && (
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} selected
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Best windows
              <span className="text-xs font-normal text-muted-foreground ml-auto">
                {timezone}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((slot, i) => (
              <div
                key={`${slot.start}-${i}`}
                className="rounded-lg border bg-card p-3 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                  <span className="font-medium text-sm">{slot.displayStart}</span>
                  <Badge
                    variant={
                      slot.confidence === "high"
                        ? "success"
                        : slot.confidence === "medium"
                          ? "secondary"
                          : "outline"
                    }
                    className="text-[10px] capitalize"
                  >
                    {slot.confidence}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto font-medium">
                    {slot.combinedScore}% match
                  </span>
                </div>

                <p className="text-xs text-muted-foreground ml-4">
                  through {slot.displayEnd} · {slot.windowHours}h window
                </p>

                {slot.friendScores.length > 0 && (
                  <div className="flex gap-2 flex-wrap ml-4">
                    {slot.friendScores.map((f) => (
                      <span
                        key={f.friendId}
                        className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5"
                      >
                        {f.displayName} {f.probability}%
                      </span>
                    ))}
                  </div>
                )}

                <div className="ml-4 pt-1">
                  <Link href={buildPlanLink(slot)}>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                      Plan this
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {empty && !loading && (
        <Card>
          <CardContent className="py-8 text-center">
            <Zap className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Not enough stream history for these people — refresh their data from the People tab and try again.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
