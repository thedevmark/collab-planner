"use client";

import { useState, useEffect, Suspense } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Twitch, MessageSquare, Unlink, ExternalLink } from "lucide-react";
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

  // Public API state
  const [publicApiEnabled, setPublicApiEnabled] = useState(false);
  const [savingPublicApi, setSavingPublicApi] = useState(false);

  // Discord state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [savingDiscord, setSavingDiscord] = useState(false);
  const [savedDiscord, setSavedDiscord] = useState(false);
  const [discordBanner, setDiscordBanner] = useState<"connected" | "error" | "canceled" | null>(null);

  useEffect(() => {
    if (settings && !settings.error) {
      setTimezone(settings.timezone ?? "UTC");
      setPublicApiEnabled(Boolean(settings.publicApiEnabled));
      setWebhookUrl(settings.discordWebhookUrl ?? "");
    }
  }, [settings]);

  async function togglePublicApi(next: boolean) {
    setPublicApiEnabled(next); // optimistic
    setSavingPublicApi(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicApiEnabled: next }),
      });
      if (!res.ok) throw new Error("Save failed");
      mutate();
    } catch {
      // revert on failure
      setPublicApiEnabled(!next);
    } finally {
      setSavingPublicApi(false);
    }
  }

  // Handle ?discord= query param from OAuth callback
  useEffect(() => {
    const status = searchParams.get("discord");
    if (status === "connected" || status === "error" || status === "canceled") {
      setDiscordBanner(status as typeof discordBanner);
      if (status === "connected") mutate();
    }
  }, [searchParams, mutate]);

  async function saveDiscordSettings() {
    setSavingDiscord(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordWebhookUrl: webhookUrl.trim() || null,
        }),
      });
      mutate();
      setSavedDiscord(true);
      setTimeout(() => setSavedDiscord(false), 2000);
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
        discordWebhookUrl: null,
      }),
    });
    await fetch("/api/auth/discord/disconnect", { method: "POST" });
    setWebhookUrl("");
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

      {/* Public API */}
      <Card>
        <CardHeader>
          <CardTitle>Public API</CardTitle>
          <CardDescription>
            Expose your upcoming collabs via read-only JSON endpoints. Off by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Enable public API</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Turning this on lets <em>anyone</em> fetch your upcoming confirmed events by your Twitch login — no authentication required. Only titles, times, game names, and participant display names are exposed. Descriptions, notes, and canceled events stay private.
              </p>
            </div>
            <button
              aria-checked={publicApiEnabled}
              aria-label="Toggle public API"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                publicApiEnabled ? "bg-primary" : "bg-zinc-700"
              } ${savingPublicApi ? "opacity-60" : ""}`}
              disabled={savingPublicApi}
              onClick={() => { void togglePublicApi(!publicApiEnabled); }}
              role="switch"
              type="button"
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  publicApiEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <a
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            href="/api"
            rel="noreferrer"
            target="_blank"
          >
            Read the API docs
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>

      {/* Discord */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#5865F2]" />
            Discord
          </CardTitle>
          <CardDescription>
            Automatically post to a Discord channel when you plan, confirm, or get reminded of a collab.
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
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    type="url"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    In Discord: open your server → channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.{" "}
                    <a
                      href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground"
                    >
                      Learn more <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={saveDiscordSettings}
                  disabled={savingDiscord}
                >
                  {savingDiscord ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : savedDiscord ? (
                    <Check className="h-4 w-4" />
                  ) : null}
                  {savedDiscord ? "Saved!" : "Save Webhook"}
                </Button>

                {settings.discordWebhookUrl && (
                  <p className="text-xs text-muted-foreground">
                    Webhook configured — notifications will post to this channel.
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
