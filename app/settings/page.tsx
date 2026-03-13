"use client";

import { useState, useEffect, Suspense } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Eye, EyeOff, ExternalLink, AlertTriangle } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function SettingsForm() {
  const { data: settings, mutate } = useSWR("/api/settings", fetcher);

  const [twitchUsername, setTwitchUsername] = useState("");
  const [twitchClientId, setTwitchClientId] = useState("");
  const [twitchClientSecret, setTwitchClientSecret] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");

  const [showTwitchSecret, setShowTwitchSecret] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (settings && !settings.error) {
      setTwitchUsername(settings.twitchUsername ?? "");
      setTwitchClientId(settings.twitchClientId ?? "");
      setTwitchClientSecret(settings.twitchClientSecret ?? "");
      setGeminiApiKey(settings.geminiApiKey ?? "");
    }
  }, [settings]);

  async function saveSettings() {
    setSaving(true);
    setSaveError("");
    try {
      const body: Record<string, string> = {};

      // Always send username
      body.twitchUsername = twitchUsername;

      // Only send keys if the user typed a new value (not the masked version)
      if (twitchClientId && !twitchClientId.startsWith("••")) {
        body.twitchClientId = twitchClientId;
      }
      if (twitchClientSecret && !twitchClientSecret.startsWith("••")) {
        body.twitchClientSecret = twitchClientSecret;
      }
      if (geminiApiKey && !geminiApiKey.startsWith("••")) {
        body.geminiApiKey = geminiApiKey;
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const hasTwitchKeys = settings?.hasTwitchKeys ?? false;
  const hasGeminiKey = settings?.hasGeminiKey ?? false;
  const isConfigured = hasTwitchKeys && hasGeminiKey;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your API keys and Twitch account</p>
      </div>

      {!isConfigured && (
        <Card className="border-yellow-600/50 bg-yellow-950/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Setup required</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {!hasTwitchKeys && !hasGeminiKey
                    ? "Add your Twitch and Gemini API keys below to get started."
                    : !hasTwitchKeys
                    ? "Add your Twitch API keys to search for friends and fetch stream data."
                    : "Add your Gemini API key to enable AI-powered suggestions."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Twitch API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Twitch API</CardTitle>
              <CardDescription className="mt-1">Required for searching friends and fetching stream data</CardDescription>
            </div>
            <Badge variant={hasTwitchKeys ? "success" : "secondary"}>
              {hasTwitchKeys ? "Connected" : "Not set"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md space-y-1">
            <p className="font-medium text-foreground">How to get your Twitch keys:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Go to the <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline">Twitch Developer Console</a></li>
              <li>Log in and click <strong>Register Your Application</strong></li>
              <li>Name: anything (e.g. "Collab Organizer"), OAuth Redirect: <code className="bg-background px-1 rounded">http://localhost:3000</code></li>
              <li>Category: <strong>Application Integration</strong>, then click <strong>Create</strong></li>
              <li>Click <strong>Manage</strong> on your app to find your <strong>Client ID</strong></li>
              <li>Click <strong>New Secret</strong> to generate your <strong>Client Secret</strong></li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label htmlFor="twitchClientId">Client ID</Label>
            <Input
              id="twitchClientId"
              placeholder="e.g. abc123def456..."
              value={twitchClientId}
              onChange={(e) => setTwitchClientId(e.target.value)}
              onFocus={() => { if (twitchClientId.startsWith("••")) setTwitchClientId(""); }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="twitchClientSecret">Client Secret</Label>
            <div className="relative">
              <Input
                id="twitchClientSecret"
                type={showTwitchSecret ? "text" : "password"}
                placeholder="e.g. xyz789..."
                value={twitchClientSecret}
                onChange={(e) => setTwitchClientSecret(e.target.value)}
                onFocus={() => { if (twitchClientSecret.startsWith("••")) setTwitchClientSecret(""); }}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowTwitchSecret(!showTwitchSecret)}
              >
                {showTwitchSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gemini API Key */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Google Gemini API</CardTitle>
              <CardDescription className="mt-1">Powers AI-generated time suggestions, game picks, and Discord messages</CardDescription>
            </div>
            <Badge variant={hasGeminiKey ? "success" : "secondary"}>
              {hasGeminiKey ? "Connected" : "Not set"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md space-y-1">
            <p className="font-medium text-foreground">How to get your Gemini key:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google AI Studio</a></li>
              <li>Sign in with your Google account</li>
              <li>Click <strong>Create API key</strong></li>
              <li>Copy the key and paste it below</li>
            </ol>
            <p className="mt-1">Free tier includes generous limits. For heavy use, enable billing in Google Cloud Console.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="geminiApiKey">API Key</Label>
            <div className="relative">
              <Input
                id="geminiApiKey"
                type={showGeminiKey ? "text" : "password"}
                placeholder="e.g. AIzaSy..."
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                onFocus={() => { if (geminiApiKey.startsWith("••")) setGeminiApiKey(""); }}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
              >
                {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Your Twitch Account */}
      <Card>
        <CardHeader>
          <CardTitle>Your Twitch Account</CardTitle>
          <CardDescription>Your username — used to include your own streaming patterns in AI suggestions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Twitch Username</Label>
            <Input
              id="username"
              placeholder="your_username"
              value={twitchUsername}
              onChange={(e) => setTwitchUsername(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Saving this will pull your stream history so the AI can find times that work for you too.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Saved!" : "Save Settings"}
        </Button>
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      </div>
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
