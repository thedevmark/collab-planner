"use client";

import useSWR from "swr";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Loader2 } from "lucide-react";

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

function friendColor(friend: Friend, index: number): string {
  return friend.channelColor || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

/**
 * "Plan with a friend" — person-first entry into the planning flow.
 *
 * Compact picker: click one person, land on /events/new?friendId=X with
 * that friend pre-selected. Intentionally minimal (no signals, no stream
 * pattern, no invite CTAs) — single job: pick and go.
 */
export default function PlanWithFriendPage() {
  const { data: friends, isLoading } = useSWR<Friend[]>("/api/friends", fetcher);
  const nonMeFriends = (friends ?? []).filter((f) => !f.isMe);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Plan with a friend</h1>
        <p className="text-sm text-muted-foreground">
          Pick someone and we&apos;ll set up the session with them already added.
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
            return (
              <Link
                key={friend.id}
                href={`/events/new?friendId=${friend.id}`}
                className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-all hover:border-primary/60 hover:bg-accent"
              >
                <Avatar className="h-10 w-10 shrink-0" style={{ boxShadow: `0 0 0 2px ${color}40` }}>
                  <AvatarImage src={friend.avatarUrl ?? undefined} />
                  <AvatarFallback>{friend.displayName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{friend.displayName}</p>
                  <p className="text-xs text-muted-foreground">Plan a session together</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
