"use client";

import { useState, useEffect, Suspense } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Twitch, MessageSquare, Unlink } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import Image from "next/image";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "America/Toronto",
  "America/Phoenix",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Moscow",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function SettingsForm() {
  const { data: settings, mutate } = useSWR("/api/settings", fetcher);
  const { user } = useUser();
  const searchParams = useSearchParams();

  const [timezone, setTimezone] = useState("UTC");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Discord state
  const [guilds, setGuilds] = useState<{ id: string; name: string; owner: boolean }[]>([]);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [loadingGuilds, setLoadingGuilds] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelsError, setChannelsError] = useState("");
  const [savingDiscord, setSavingDiscord] = useState(false);
  const [discordBanner, setDiscordBanner] = useState<"connected" | "error" | "canceled" | null>(null);

  useEffect(() => {
    if (settings && !settings.error) {
      setTimezone(settings.timezone ?? "UTC");
      setSelectedGuildId(settings.discordGuildId ?? "");
      setSelectedChannelId(settings.discordChannelId ?? "");
    }
  }, [settings]);

  // Handle ?discord= query param from OAuth callback
  useEffect(() => {
    const status = searchParams.get("discord");
    if (status === "connected" || status === "error" || status === "canceled") {
      setDiscordBanner(status as typeof discordBanner);
      if (status === "connected") mutate();
    }
  }, [searchParams, mutate]);

  // Load guilds when Discord is connected
  useEffect(() => {
    if (!settings?.discordUsername) return;
    setLoadingGuilds(true);
    fetch("/api/discord/guilds")
      .then((r) => r.json())
      .then((d) => setGuilds(d.guilds ?? []))
      .catch(() => {})
      .finally(() => setLoadingGuilds(false));
  }, [settings?.discordUsername]);

  // Load channels when guild changes
  useEffect(() => {
    if (!selectedGuildId) { setChannels([]); setChannelsError(""); return; }
    setLoadingChannels(true);
    setChannelsError("");
    fetch(`/api/discord/channels?guildId=${selectedGuildId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setChannelsError(`Couldn't load channels: ${d.error}`);
          setChannels([]);
        } else {
          setChannels(d.channels ?? []);
        }
      })
      .catch(() => setChannelsError("Failed to load channels."))
      .finally(() => setLoadingChannels(false));
  }, [selectedGuildId]);

  async function saveDiscordSettings() {
    setSavingDiscord(true);
    try {
      const guild = guilds.find((g) => g.id === selectedGuildId);
      const channel = channels.find((c) => c.id === selectedChannelId);
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordGuildId: selectedGuildId || null,
          discordGuildName: guild?.name ?? null,
          discordChannelId: selectedChannelId || null,
          discordChannelName: channel?.name ?? null,
        }),
      });
      mutate();
    } finally {
      setSavingDiscord(false);
    }
  }

  async function disconnectDiscord() {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discordGuildId: null,
        discordGuildName: null,
        discordChannelId: null,
        discordChannelName: null,
      }),
    });
    // Clear tokens via dedicated disconnect endpoint
    await fetch("/api/auth/discord/disconnect", { method: "POST" });
    setSelectedGuildId("");
    setSelectedChannelId("");
    setGuilds([]);
    setChannels([]);
    mutate();
  }

  async function saveSettings() {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }

      mutate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = (user?.user_metadata?.full_name ?? user?.user_metadata?.user_name ?? "") as string;
  const twitchUsername = (user?.user_metadata?.user_name ?? user?.user_metadata?.preferred_username ?? "") as string;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Your account and preferences</p>
      </div>

      {/* Connected Account */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Account</CardTitle>
          <CardDescription>Logged in via Twitch OAuth</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={displayName} width={48} height={48} className="rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-lg font-bold text-white">
                {displayName[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div>
              <p className="font-semibold">{displayName}</p>
              {twitchUsername && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Twitch className="h-3.5 w-3.5 text-primary" />
                  @{twitchUsername}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card>
        <CardHeader>
          <CardTitle>Timezone</CardTitle>
          <CardDescription>Used to display stream times and scheduling predictions in your local time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            style={{ colorScheme: "dark" }}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Saved!" : "Save Settings"}
        </Button>
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      </div>

      {/* Discord */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#5865F2]" />
            Discord
          </CardTitle>
          <CardDescription>
            Automatically post to Discord when you plan, confirm, or get reminded of a collab.
            A Discord Scheduled Event is also created so your community can RSVP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {discordBanner === "connected" && (
            <div className="rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-3 py-2">
              ✅ Discord connected successfully!
            </div>
          )}
          {discordBanner === "error" && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
              Something went wrong connecting Discord. Please try again.
            </div>
          )}

          {!settings?.discordUsername ? (
            <a href="/api/auth/discord">
              <Button className="bg-[#5865F2] hover:bg-[#4752c4] text-white gap-2">
                <MessageSquare className="h-4 w-4" />
                Connect Discord
              </Button>
            </a>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Connected as</span>
                  <span className="font-medium">{settings.discordUsername}</span>
                </div>
                <Button variant="ghost" size="sm" className="text-muted-foreground h-7 gap-1" onClick={disconnectDiscord}>
                  <Unlink className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Server</Label>
                  {loadingGuilds ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading servers...
                    </div>
                  ) : (
                    <select
                      value={selectedGuildId}
                      onChange={(e) => { setSelectedGuildId(e.target.value); setSelectedChannelId(""); }}
                      className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      style={{ colorScheme: "dark" }}
                    >
                      <option value="">Select a server...</option>
                      {guilds.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}{g.owner ? " (owner)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedGuildId && (
                  <div className="space-y-1.5">
                    <Label>Notification channel</Label>
                    {loadingChannels ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading channels...
                      </div>
                    ) : channelsError ? (
                      <div className="space-y-2">
                        <p className="text-sm text-destructive">{channelsError}</p>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline underline-offset-2"
                          onClick={() => {
                            const id = selectedGuildId;
                            setSelectedGuildId("");
                            setTimeout(() => setSelectedGuildId(id), 0);
                          }}
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <select
                        value={selectedChannelId}
                        onChange={(e) => setSelectedChannelId(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        style={{ colorScheme: "dark" }}
                      >
                        <option value="">Select a channel...</option>
                        {channels.map((c) => (
                          <option key={c.id} value={c.id}>#{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {selectedGuildId && (
                  <Button
                    size="sm"
                    onClick={saveDiscordSettings}
                    disabled={savingDiscord || !selectedChannelId}
                  >
                    {savingDiscord ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save Discord Settings
                  </Button>
                )}

                {settings.discordChannelName && (
                  <p className="text-xs text-muted-foreground">
                    Posting to <span className="font-medium text-foreground">#{settings.discordChannelName}</span> in <span className="font-medium text-foreground">{settings.discordGuildName}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsForm />
    </Suspense>
  );
}
