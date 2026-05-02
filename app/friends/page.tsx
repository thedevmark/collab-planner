"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserPlus, Search, Loader2, TrendingUp, Users2, CalendarClock, Gamepad2, Link2, Sparkles, RefreshCw, Check, X, Star, Trash2 } from "lucide-react";
import { InviteDialog } from "@/components/InviteDialog";

type ImportFollower = {
  twitchId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  followedAt: string;
};

const FALLBACK_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function StreamPattern({ friend, accentColor }: { friend: any; accentColor: string }) {
  const history = friend.streamHistory ?? [];
  const dayCounts: Record<number, number> = {};
  const hours: number[] = [];
  const gameCounts: Record<string, number> = {};

  for (const s of history) {
    const d = new Date(s.startTime).getDay();
    dayCounts[d] = (dayCounts[d] ?? 0) + 1;
    hours.push(new Date(s.startTime).getHours());
    if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + 1;
  }
  for (const s of friend.scheduleSegments ?? []) {
    const d = new Date(s.startTime).getDay();
    dayCounts[d] = (dayCounts[d] ?? 0) + 0.5;
    hours.push(new Date(s.startTime).getHours());
    if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + 0.5;
  }

  let topDays: string[];
  let timeLabel: string;
  let isEstimate = false;

  if (hours.length > 0) {
    topDays = Object.entries(dayCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([d]) => DAYS_SHORT[parseInt(d)]);
    hours.sort((a, b) => a - b);
    const med = hours[Math.floor(hours.length / 2)];
    const h = med % 12 || 12;
    timeLabel = `~${h}${med >= 12 ? "PM" : "AM"}`;
    isEstimate = history.length < 3;
  } else {
    topDays = [];
    timeLabel = "";
    isEstimate = true;
  }

  const topGame = Object.entries(gameCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0];

  if (isEstimate && topDays.length === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <TrendingUp className="h-3 w-3" />
        No stream data yet
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <TrendingUp className="h-3 w-3" />
        {isEstimate ? "Est." : "Streams"} {topDays.join(", ")} {timeLabel}
      </div>
      <div className="flex gap-1 flex-wrap">
        {DAYS_SHORT.map((d) => (
          <span
            key={d}
            className={`text-[10px] px-1 py-0.5 rounded font-medium ${topDays.includes(d) ? "" : "bg-muted text-muted-foreground"}`}
            style={topDays.includes(d) ? { backgroundColor: accentColor, color: "#fff" } : undefined}
          >{d}</span>
        ))}
      </div>
      {topGame && <Badge variant="outline" className="text-xs">{topGame}</Badge>}
    </div>
  );
}

function RecentCollabSummary({ friend, accentColor }: { friend: any; accentColor: string }) {
  const recentCollabs = friend.recentCollabs ?? [];
  if (recentCollabs.length === 0) return null;

  const latest = recentCollabs[0];
  const activity = latest.gameName || latest.description;

  return (
    <div
      className="rounded-md border px-2.5 py-2 space-y-1.5"
      style={{ borderColor: accentColor + "40", backgroundColor: accentColor + "10" }}
    >
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <CalendarClock className="h-3 w-3 shrink-0" />
        <span className="truncate">
          Last collab {format(new Date(latest.startTime), "MMM d, yyyy")}
          {recentCollabs.length > 1 ? ` · ${recentCollabs.length} total` : ""}
        </span>
      </div>
      <p className="text-xs font-medium truncate">{latest.title}</p>
      {activity ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          <Gamepad2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{activity}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function FriendsPage() {
  const { data: friends = [], mutate } = useSWR("/api/friends", fetcher);
  const [search, setSearch] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [channelQuery, setChannelQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [syncing, setSyncing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [dismissingId, setDismissingId] = useState<number | null>(null);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importFollowers, setImportFollowers] = useState<ImportFollower[]>([]);
  const [selectedImportLogins, setSelectedImportLogins] = useState<string[]>([]);
  const [manualImportUsername, setManualImportUsername] = useState("");
  const [importMeta, setImportMeta] = useState({ total: 0, existingCount: 0, capped: false });

  const { data: channelResults = [] } = useSWR(
    channelQuery.length >= 2 ? `/api/twitch/channels?q=${encodeURIComponent(channelQuery)}` : null,
    fetcher
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const meFriend = friends.find((f: any) => f.isMe);
  const nonMeFriends = friends.filter((f: any) => !f.isMe);
  const confirmedFriends = nonMeFriends.filter((f: any) => !f.isSuggested);
  const suggestedFriends = nonMeFriends.filter((f: any) => f.isSuggested);
  const favoriteCount = confirmedFriends.filter((f: any) => f.isFavorite).length;
  const filtered = confirmedFriends
    .filter((f: any) =>
      f.displayName.toLowerCase().includes(search.trim().toLowerCase()) ||
      f.username.toLowerCase().includes(search.trim().toLowerCase())
    )
    .sort((a: any, b: any) => {
      if (a.isFavorite !== b.isFavorite) return Number(b.isFavorite) - Number(a.isFavorite);
      return a.displayName.localeCompare(b.displayName);
    });

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

  async function syncSuggestions() {
    setSyncing(true);
    try {
      await fetch("/api/friends/sync-suggestions", { method: "POST" });
      mutate();
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  }

  async function loadFollowerImport() {
    setImportLoading(true);
    setImportError("");
    setImportFollowers([]);
    setSelectedImportLogins([]);
    setImportMeta({ total: 0, existingCount: 0, capped: false });
    try {
      const res = await fetch("/api/friends/import-followers");
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Failed to load Twitch followers");
        return;
      }
      const followers = data.followers ?? [];
      setImportFollowers(followers);
      setSelectedImportLogins(followers.slice(0, 50).map((f: ImportFollower) => f.username.toLowerCase()));
      setImportMeta({
        total: data.total ?? followers.length,
        existingCount: data.existingCount ?? 0,
        capped: Boolean(data.capped),
      });
    } catch {
      setImportError("Failed to load Twitch followers");
    } finally {
      setImportLoading(false);
    }
  }

  function toggleImportLogin(username: string) {
    const login = username.toLowerCase();
    setSelectedImportLogins((current) =>
      current.includes(login) ? current.filter((item) => item !== login) : [...current, login]
    );
  }

  function addManualImportUsername() {
    const login = manualImportUsername.trim().replace(/^@/, "").toLowerCase();
    if (!login) return;
    setSelectedImportLogins((current) => current.includes(login) ? current : [...current, login]);
    setManualImportUsername("");
    setImportError("");
  }

  async function importSelectedFollowers() {
    if (selectedImportLogins.length === 0 || selectedImportLogins.length > 50) return;
    setImporting(true);
    setImportError("");
    try {
      const res = await fetch("/api/friends/import-followers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: selectedImportLogins }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Failed to import Twitch followers");
        return;
      }
      setImportDialogOpen(false);
      mutate();
    } catch {
      setImportError("Failed to import Twitch followers");
    } finally {
      setImporting(false);
    }
  }

  async function confirmSuggestion(id: number) {
    setConfirmingId(id);
    try {
      await fetch(`/api/friends/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuggested: false }),
      });
      mutate();
    } finally {
      setConfirmingId(null);
    }
  }

  async function dismissSuggestion(id: number) {
    setDismissingId(id);
    try {
      await fetch(`/api/friends/${id}`, { method: "DELETE" });
      mutate();
    } finally {
      setDismissingId(null);
    }
  }

  async function toggleFavorite(id: number, isFavorite: boolean) {
    setTogglingFavoriteId(id);
    try {
      await fetch(`/api/friends/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite }),
      });
      mutate();
    } finally {
      setTogglingFavoriteId(null);
    }
  }

  async function deleteFriend(id: number, displayName: string) {
    if (!window.confirm(`Remove ${displayName} from your people list?`)) return;
    setDeletingId(id);
    try {
      await fetch(`/api/friends/${id}`, { method: "DELETE" });
      mutate();
    } finally {
      setDeletingId(null);
    }
  }

  const meColor = meFriend?.channelColor || "#7aa2f7";
  const importFollowersByLogin = new Map(
    importFollowers.map((follower) => [follower.username.toLowerCase(), follower])
  );
  const selectedImportPeople = selectedImportLogins.map((login) => importFollowersByLogin.get(login) ?? {
    twitchId: login,
    username: login,
    displayName: login,
    avatarUrl: "",
    followedAt: "",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">People</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={syncSuggestions} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Suggestions
          </Button>
          <Dialog
            open={importDialogOpen}
            onOpenChange={(open) => {
              setImportDialogOpen(open);
              if (open) {
                void loadFollowerImport();
              } else {
                setImportError("");
                setManualImportUsername("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Users2 className="h-4 w-4" />
                Import Followers
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import Twitch Followers</DialogTitle>
                <DialogDescription>
                  Review the follower list, remove anyone you do not want, or add more Twitch usernames before importing.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {importLoading ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg border py-10 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading followers...
                  </div>
                ) : importError && importFollowers.length === 0 ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {importError}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary">{selectedImportLogins.length} selected</Badge>
                      <span>{importMeta.total} followers found</span>
                      {importMeta.existingCount > 0 && <span>{importMeta.existingCount} already in People</span>}
                      {importMeta.capped && <span>Showing the first {importFollowers.length}</span>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="manual-import">Add more Twitch usernames</Label>
                      <div className="flex gap-2">
                        <Input
                          id="manual-import"
                          placeholder="username"
                          value={manualImportUsername}
                          onChange={(e) => setManualImportUsername(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addManualImportUsername();
                            }
                          }}
                        />
                        <Button type="button" variant="outline" onClick={addManualImportUsername}>
                          Add
                        </Button>
                      </div>
                    </div>

                    {selectedImportLogins.length > 50 && (
                      <p className="text-sm text-destructive">Import up to 50 people at a time.</p>
                    )}

                    {importError && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {importError}
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Follower preview</Label>
                          {importFollowers.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedImportLogins(importFollowers.slice(0, 50).map((f) => f.username.toLowerCase()))}
                            >
                              Select first 50
                            </Button>
                          )}
                        </div>
                        <div className="max-h-72 overflow-y-auto rounded-lg border">
                          {importFollowers.length === 0 ? (
                            <p className="p-4 text-sm text-muted-foreground">No new followers to import.</p>
                          ) : (
                            importFollowers.map((follower) => {
                              const checked = selectedImportLogins.includes(follower.username.toLowerCase());
                              return (
                                <button
                                  key={follower.twitchId}
                                  type="button"
                                  className="flex w-full items-center gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-accent"
                                  onClick={() => toggleImportLogin(follower.username)}
                                >
                                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                                    {checked && <Check className="h-3 w-3" />}
                                  </span>
                                  <Avatar className="h-8 w-8 shrink-0">
                                    <AvatarImage src={follower.avatarUrl} />
                                    <AvatarFallback className="text-xs">{follower.displayName[0]?.toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{follower.displayName}</p>
                                    <p className="truncate text-xs text-muted-foreground">@{follower.username}</p>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Will import</Label>
                        <div className="max-h-72 overflow-y-auto rounded-lg border">
                          {selectedImportPeople.length === 0 ? (
                            <p className="p-4 text-sm text-muted-foreground">Remove or add people before importing.</p>
                          ) : (
                            selectedImportPeople.map((person) => (
                              <div key={person.username} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarImage src={person.avatarUrl} />
                                  <AvatarFallback className="text-xs">{person.displayName[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{person.displayName}</p>
                                  <p className="truncate text-xs text-muted-foreground">@{person.username}</p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground"
                                  onClick={() => setSelectedImportLogins((current) => current.filter((login) => login !== person.username.toLowerCase()))}
                                  title={`Remove ${person.displayName}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={importSelectedFollowers}
                  disabled={importing || importLoading || selectedImportLogins.length === 0 || selectedImportLogins.length > 50}
                >
                  {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Import as Friends
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <InviteDialog friends={friends}>
            <Button variant="outline">
              <Link2 className="h-4 w-4" />
              Invite People
            </Button>
          </InviteDialog>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setAddError(""); setNewUsername(""); setChannelQuery(""); setDropdownOpen(false); } }}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4" />
              Add Person
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Twitch Friend</DialogTitle>
              <DialogDescription>
                Search Twitch and add a streamer to your people list.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="username">Twitch Username</Label>
                <div className="relative" ref={dropdownRef}>
                  <Input
                    id="username"
                    placeholder="Search for a Twitch user..."
                    value={newUsername}
                    onChange={(e) => {
                      setNewUsername(e.target.value);
                      setChannelQuery(e.target.value);
                      setDropdownOpen(true);
                      setAddError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && addFriend()}
                    onFocus={() => channelQuery.length >= 2 && setDropdownOpen(true)}
                  />
                  {dropdownOpen && channelResults.length > 0 && channelQuery && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 border rounded-md bg-background shadow-md max-h-64 overflow-y-auto">
                      {channelResults.slice(0, 8).map((ch: any) => (
                        <button
                          key={ch.id}
                          className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-3"
                          onClick={() => {
                            setNewUsername(ch.broadcaster_login);
                            setChannelQuery("");
                            setDropdownOpen(false);
                          }}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={ch.thumbnail_url} />
                            <AvatarFallback className="text-xs">{ch.display_name[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{ch.display_name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {ch.is_live ? (
                                <span className="text-green-500">Live</span>
                              ) : (
                                <span>Offline</span>
                              )}
                              {ch.game_name ? ` · ${ch.game_name}` : ""}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
      </div>

      {/* Your own card — always at the top */}
      {meFriend && (
        <Link href={`/friends/${meFriend.id}`}>
          <Card
            className="hover:shadow-md transition-shadow cursor-pointer"
            style={{ borderColor: meColor + "60" }}
          >
            <div className="h-0.5 rounded-t-lg" style={{ backgroundColor: meColor }} />
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12" style={{ outline: `2px solid ${meColor}40`, outlineOffset: "2px" }}>
                  <AvatarImage src={meFriend.avatarUrl} />
                  <AvatarFallback className="text-lg">{meFriend.displayName[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{meFriend.displayName}</p>
                    <Badge className="text-xs shrink-0" style={{ backgroundColor: meColor, color: "#fff", border: "none" }}>You</Badge>
                  </div>
                  {meFriend.username ? (
                    <p className="text-sm text-muted-foreground">@{meFriend.username}</p>
                  ) : null}
                </div>
                <div className="shrink-0">
                  <StreamPattern friend={meFriend} accentColor={meColor} />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Suggested friends section */}
      {suggestedFriends.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="font-semibold text-sm">Suggested · {suggestedFriends.length}</span>
              <p className="text-xs text-muted-foreground">Based on your collab history</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {suggestedFriends.map((friend: any) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 rounded-lg border border-dashed bg-card/50 px-3 py-2.5"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={friend.avatarUrl} />
                  <AvatarFallback>{friend.displayName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{friend.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">@{friend.username}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    title="Add friend"
                    disabled={confirmingId === friend.id}
                    onClick={() => confirmSuggestion(friend.id)}
                  >
                    {confirmingId === friend.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground"
                    title="Dismiss"
                    disabled={dismissingId === friend.id}
                    onClick={() => dismissSuggestion(friend.id)}
                  >
                    {dismissingId === friend.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 pt-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search people..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
        {favoriteCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-current text-yellow-400" />
            Favorites appear first in planning and session setup.
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No people yet</p>
          <p className="text-sm mb-4">Add your Twitch people to start planning sessions</p>
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add Person
          </Button>
        </div>
      ) : (
        <div className="grid auto-rows-fr grid-cols-2 gap-4 xl:grid-cols-3">
          {filtered.map((friend: any, idx: number) => {
            const accentColor = friend.channelColor || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
            // Filter self-mentions out of the collab partner list
            const partnerNames = (() => {
              if (!friend.collabSignals?.length) return { names: [] as string[], extra: 0 };
              const partnerMap = new Map<string, string>();
              const selfKeys = new Set(
                [friend.username, friend.displayName]
                  .filter(Boolean)
                  .map((s: string) => s.toLowerCase()),
              );
              for (const s of friend.collabSignals) {
                const key = (s.partnerLogin || s.partnerName || "").toLowerCase();
                if (!key || selfKeys.has(key)) continue;
                if (!partnerMap.has(key)) partnerMap.set(key, s.partnerName);
              }
              const all = Array.from(partnerMap.values());
              return { names: all.slice(0, 2), extra: Math.max(0, all.length - 2) };
            })();

            return (
              <Link key={friend.id} href={`/friends/${friend.id}`}>
                <Card
                  className="flex h-full flex-col transition-shadow hover:shadow-md cursor-pointer"
                  style={{ borderColor: accentColor + "50" }}
                >
                  <div className="h-0.5 rounded-t-lg" style={{ backgroundColor: accentColor }} />
                  <CardContent className="flex flex-1 flex-col pt-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12" style={{ outline: `2px solid ${accentColor}40`, outlineOffset: "2px" }}>
                        <AvatarImage src={friend.avatarUrl} />
                        <AvatarFallback className="text-lg">
                          {friend.displayName[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{friend.displayName}</p>
                          {friend.isFavorite && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              Favorite
                            </Badge>
                          )}
                        </div>
                        {friend.username ? (
                          <p className="text-sm text-muted-foreground truncate">@{friend.username}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={togglingFavoriteId === friend.id}
                          onClick={(e) => {
                            e.preventDefault();
                            void toggleFavorite(friend.id, !friend.isFavorite);
                          }}
                          title={friend.isFavorite ? "Remove favorite" : "Mark as favorite"}
                        >
                          {togglingFavoriteId === friend.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Star className={`h-4 w-4 ${friend.isFavorite ? "fill-current text-yellow-400" : "text-muted-foreground"}`} />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          disabled={deletingId === friend.id}
                          onClick={(e) => {
                            e.preventDefault();
                            void deleteFriend(friend.id, friend.displayName);
                          }}
                          title={`Remove ${friend.displayName}`}
                        >
                          {deletingId === friend.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <StreamPattern friend={friend} accentColor={accentColor} />
                    <RecentCollabSummary friend={friend} accentColor={accentColor} />

                    {partnerNames.names.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          w/ {partnerNames.names.join(", ")}
                          {partnerNames.extra > 0 ? ` +${partnerNames.extra}` : ""}
                        </span>
                      </div>
                    )}

                    {friend.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic">
                        {friend.notes}
                      </p>
                    )}

                    <div className="mt-auto pt-2" onClick={(e) => e.preventDefault()}>
                      <InviteDialog friends={friends} defaultFriendIds={[friend.id]}>
                        <Button
                          size="sm"
                          className="group h-9 w-full gap-1.5 bg-primary text-primary-foreground shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-primary/90 hover:shadow-md active:translate-y-0 active:shadow-sm"
                        >
                          <Link2 className="h-3.5 w-3.5 transition-transform group-hover:-rotate-12" />
                          Invite to Collab
                        </Button>
                      </InviteDialog>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
