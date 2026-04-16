"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { AvailabilityMatrix } from "@/components/events/AvailabilityMatrix";
import type { ScoredSlot } from "@/lib/scheduling/overlap";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Friend {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  isMe: boolean;
  channelColor: string | null;
}

const FALLBACK_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

// Matches NewEventForm's default 3h window so the handoff lands clean.
const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;

function friendColor(friend: Friend, index: number): string {
  return friend.channelColor || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function toLocalDatetimeValue(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

/**
 * "Plan with a friend" — person-first planning flow.
 *
 * Pick one friend, then use the Workable Windows grid (AvailabilityMatrix —
 * same component /events/new uses) to scan the next 7 days for blocks that
 * fit both of you. Clicking a cell forwards the start time + friendId into
 * /events/new so the user continues with title / game / description.
 *
 * The "find overlap" page handles group patterns; this one is deliberately
 * singular — tighter grid, one-person signal, fast path to a session.
 */
export default function PlanWithFriendPage() {
  const router = useRouter();
  const { data: friends, isLoading } = useSWR<Friend[]>("/api/friends", fetcher);
  const { data: profile } = useSWR("/api/profile/onboarding", fetcher);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const nonMeFriends = (friends ?? []).filter((f) => !f.isMe);
  const meFriend = (friends ?? []).find((f) => f.isMe);

  // Matrix scores the full group, so "me" is implicit — the picker only
  // lists others.
  const matrixIds = useMemo(() => {
    if (selectedId === null) return [];
    const ids = [selectedId];
    if (meFriend) ids.push(meFriend.id);
    return ids;
  }, [selectedId, meFriend]);

  const timezone =
    profile?.timezone ??
    (typeof window !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC");

  const anchorStart = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return toLocalDatetimeValue(d);
  }, []);

  function handleApplySlot(slot: ScoredSlot) {
    if (selectedId === null) return;
    const params = new URLSearchParams();
    params.set("startTime", slot.start.toISOString());
    params.set("friendId", String(selectedId));
    router.push(`/events/new?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Plan with a friend</h1>
        <p className="text-sm text-muted-foreground">
          Pick someone, then click a block that works for both of you.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : nonMeFriends.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">No people added yet.</p>
            <Link href="/friends" className="text-sm text-primary underline mt-2 inline-block">
              Add people first
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {nonMeFriends.map((friend, i) => {
            const color = friendColor(friend, i);
            const selected = selectedId === friend.id;
            return (
              <button
                key={friend.id}
                type="button"
                onClick={() => setSelectedId(selected ? null : friend.id)}
                className={`group flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                  selected
                    ? "border-primary bg-primary/10"
                    : "bg-card hover:border-primary/60 hover:bg-accent"
                }`}
              >
                <Avatar className="h-10 w-10 shrink-0" style={{ boxShadow: `0 0 0 2px ${color}40` }}>
                  <AvatarImage src={friend.avatarUrl ?? undefined} />
                  <AvatarFallback>{friend.displayName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{friend.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected ? "Scanning workable windows below…" : "Click to see workable windows"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedId !== null && friends && (
        <AvailabilityMatrix
          friends={friends}
          selectedFriendIds={matrixIds}
          timezone={timezone}
          anchorStart={anchorStart}
          selectedStartTime=""
          durationMs={DEFAULT_DURATION_MS}
          onApplySlot={handleApplySlot}
        />
      )}
    </div>
  );
}
