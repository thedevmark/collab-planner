"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserPlus, Search, Loader2, TrendingUp } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function FriendsPage() {
  const { data: friends = [], mutate } = useSWR("/api/friends", fetcher);
  const [search, setSearch] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const nonMeFriends = friends.filter((f: any) => !f.isMe);
  const filtered = nonMeFriends.filter((f: any) =>
    f.displayName.toLowerCase().includes(search.trim().toLowerCase()) ||
    f.username.toLowerCase().includes(search.trim().toLowerCase())
  );

  async function addFriend() {
    if (!newUsername.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add friend");
      } else {
        setNewUsername("");
        setDialogOpen(false);
        mutate();
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Friends</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setAddError(""); setNewUsername(""); } }}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4" />
              Add Friend
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Twitch Friend</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="username">Twitch Username</Label>
                <Input
                  id="username"
                  placeholder="e.g. shroud"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addFriend()}
                />
              </div>
              {addError && <p className="text-sm text-destructive">{addError}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={addFriend} disabled={adding || !newUsername.trim()}>
                {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Friend
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search friends..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No friends yet</p>
          <p className="text-sm mb-4">Add your Twitch friends to start planning collabs</p>
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add Friend
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {filtered.map((friend: any) => (
            <Link key={friend.id} href={`/friends/${friend.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={friend.avatarUrl} />
                      <AvatarFallback className="text-lg">
                        {friend.displayName[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{friend.displayName}</p>
                      <p className="text-sm text-muted-foreground">@{friend.username}</p>
                    </div>
                  </div>

                  {(() => {
                    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                    const history = friend.streamHistory ?? [];

                    // Build pattern from history if available, otherwise use schedule hints, otherwise estimate
                    const dayCounts: Record<number, number> = {};
                    const hours: number[] = [];
                    const gameCounts: Record<string, number> = {};

                    for (const s of history) {
                      const d = new Date(s.startTime).getDay();
                      dayCounts[d] = (dayCounts[d] ?? 0) + 1;
                      hours.push(new Date(s.startTime).getUTCHours());
                      if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + 1;
                    }

                    // Supplement with schedule hints (half weight)
                    for (const s of friend.scheduleSegments ?? []) {
                      const d = new Date(s.startTime).getDay();
                      dayCounts[d] = (dayCounts[d] ?? 0) + 0.5;
                      hours.push(new Date(s.startTime).getUTCHours());
                      if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + 0.5;
                    }

                    let topDays: string[];
                    let timeLabel: string;
                    let isEstimate = false;

                    if (hours.length > 0) {
                      topDays = Object.entries(dayCounts).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 3).map(([d]) => DAYS[parseInt(d)]);
                      hours.sort((a, b) => a - b);
                      const med = hours[Math.floor(hours.length / 2)];
                      const h = med % 12 || 12;
                      const ampm = med >= 12 ? "PM" : "AM";
                      timeLabel = `~${h}${ampm} UTC`;
                      isEstimate = history.length < 3;
                    } else {
                      // No data at all — use generic estimate
                      topDays = ["Fri", "Sat", "Sun"];
                      timeLabel = "~8PM UTC";
                      isEstimate = true;
                    }

                    const topGame = Object.entries(gameCounts).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0];

                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingUp className="h-3 w-3" />
                          {isEstimate ? "Est." : "Streams"} {topDays.join(", ")} {timeLabel}
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {DAYS.map((d) => (
                            <span key={d} className={`text-[10px] px-1 py-0.5 rounded font-medium ${topDays.includes(d) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{d}</span>
                          ))}
                        </div>
                        {topGame && <Badge variant="outline" className="text-xs">{topGame}</Badge>}
                      </div>
                    );

                  })()}

                  {friend.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">
                      {friend.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
