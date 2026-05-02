"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Check, Copy, CheckCheck, Loader2, ExternalLink, MessageSquare } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Friend {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  channelColor: string;
  isMe: boolean;
}

interface InviteDialogProps {
  friends: Friend[];
  defaultFriendIds?: number[];
  children: React.ReactNode;
}

const EXPIRY_OPTIONS: { label: string; hours: number }[] = [
  { label: "1 hour", hours: 1 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 3 * 24 },
  { label: "7 days", hours: 7 * 24 },
];

export function InviteDialog({ friends, defaultFriendIds = [], children }: InviteDialogProps) {
  const nonMeFriends = friends.filter((f) => !f.isMe);

  function initialSelectedIds() {
    return defaultFriendIds.filter((id) => {
      const f = friends.find((x) => x.id === id);
      return f && !f.isMe;
    });
  }

  const { data: settings } = useSWR("/api/settings", fetcher, { revalidateOnFocus: false });
  const hasDiscordWebhook = Boolean(settings?.discordWebhookUrl);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Collab Stream");
  const [gameName, setGameName] = useState("");
  const [gameSearch, setGameSearch] = useState("");
  const [postToDiscord, setPostToDiscord] = useState(false);
  const { data: gameResults = [] } = useSWR(
    gameSearch.length >= 2 ? `/api/twitch/categories?q=${encodeURIComponent(gameSearch)}` : null,
    fetcher
  );
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSelectedIds);
  const [expiry, setExpiry] = useState<number>(7 * 24);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ token: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  function resetForm() {
    setTitle("Collab Stream");
    setGameName("");
    setGameSearch("");
    setMessage("");
    setSelectedIds(initialSelectedIds());
    setExpiry(7 * 24);
    setPostToDiscord(false);
    setCreated(null);
    setCopied(false);
    setError("");
  }

  function toggleFriend(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          gameName: gameName.trim() || undefined,
          message: message.trim() || undefined,
          participantFriendIds: selectedIds,
          expiresIn: expiry,
          postToDiscord: postToDiscord || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create invite");
      } else {
        setCreated({ token: data.token, url: data.url });
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    await navigator.clipboard.writeText(created.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Collab Invite Link</DialogTitle>
          <DialogDescription>
            Choose participants and generate a shareable collab invite.
          </DialogDescription>
        </DialogHeader>

        {!created ? (
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="invite-title">Title</Label>
              <Input
                id="invite-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Collab Stream"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-game">
                Game{" "}
                <span className="text-muted-foreground text-xs font-normal">(optional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="invite-game"
                  value={gameName || gameSearch}
                  onChange={(e) => { setGameName(""); setGameSearch(e.target.value); }}
                  placeholder="e.g. Minecraft"
                  autoComplete="off"
                />
                {gameResults.length > 0 && gameSearch && !gameName && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 border border-border rounded-md bg-background shadow-md">
                    {gameResults.slice(0, 6).map((g: any) => (
                      <button
                        key={g.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setGameName(g.name); setGameSearch(""); }}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-message">
                Personal message{" "}
                <span className="text-muted-foreground text-xs font-normal">(optional)</span>
              </Label>
              <Textarea
                id="invite-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hey! Want to collab this week?"
                rows={2}
              />
            </div>

            {nonMeFriends.length > 0 && (
              <div className="space-y-2">
                <Label>Participants</Label>
                <div className="grid grid-cols-2 gap-2">
                  {nonMeFriends.map((f) => {
                    const selected = selectedIds.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFriend(f.id)}
                        className={`flex items-center gap-2 p-2 rounded-md border text-left transition-colors text-sm ${
                          selected
                            ? "border-primary/40 bg-primary/10"
                            : "hover:bg-accent border-border"
                        }`}
                      >
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={f.avatarUrl} />
                          <AvatarFallback className="text-[10px]">
                            {f.displayName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate flex-1">{f.displayName}</span>
                        {selected && (
                          <Check className="h-3 w-3 shrink-0 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Link expires</Label>
              <div className="flex gap-1.5">
                {EXPIRY_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setExpiry(opt.hours)}
                    className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                      expiry === opt.hours
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {hasDiscordWebhook && (
              <label className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors">
                <input
                  type="checkbox"
                  checked={postToDiscord}
                  onChange={(e) => setPostToDiscord(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-[#5865F2]"
                />
                <MessageSquare className="h-3.5 w-3.5 text-[#5865F2] shrink-0" />
                <span className="text-xs text-muted-foreground">Post to Discord</span>
              </label>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              onClick={handleCreate}
              disabled={loading || !title.trim()}
              className="w-full"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Link
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Your invite link is ready! Share it with your friends.
            </p>

            <Input value={created.url} readOnly className="text-xs font-mono" />

            <Button onClick={copyLink} className="w-full" size="lg">
              {copied ? (
                <CheckCheck className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied!" : "Copy Link"}
            </Button>

            <div className="flex items-center justify-between">
              <a
                href={`/plan?fromInvite=${created.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Open in Planner
              </a>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
