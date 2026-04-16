"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Plus } from "lucide-react";
import { StreamPatternPanel } from "@/components/events/StreamPatternPanel";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Find Overlap — person-group overlap visualization.
 *
 * Workflow: pick any subset of friends, then read the Stream Pattern Overlap
 * heatmap (extracted from /events/new's sidebar) to see which days the group
 * typically streams on and where they overlap. Clicking "Plan a session"
 * forwards the selection into the session builder.
 *
 * The per-slot Workable Windows grid lives on /plan/with-friend instead —
 * this page is deliberately broad-strokes (day-of-week overlap), not hourly.
 */
export default function FindTimeView() {
  const { data: friends = [] } = useSWR("/api/friends", fetcher);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const meFriend = friends.find((f: any) => f.isMe);
  const nonMe = friends.filter((f: any) => !f.isMe && !f.isSuggested);

  // Include "me" in the pattern calc so overlap days are computed against
  // the full group. The select-people UI only lists others — "you" is
  // implicit.
  const panelIds = useMemo(() => {
    const ids = Array.from(selectedIds);
    if (meFriend && !ids.includes(meFriend.id)) ids.push(meFriend.id);
    return ids;
  }, [selectedIds, meFriend]);

  const planHref = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const params = new URLSearchParams();
    params.set("friendIds", Array.from(selectedIds).join(","));
    return `/events/new?${params.toString()}`;
  }, [selectedIds]);

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
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <>
          <StreamPatternPanel
            selectedFriendIds={panelIds}
            allFriends={friends}
            sticky={false}
          />

          {planHref && (
            <div className="flex justify-end">
              <Link href={planHref}>
                <Button className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Plan a session with {selectedIds.size === 1 ? "them" : `these ${selectedIds.size}`}
                </Button>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
