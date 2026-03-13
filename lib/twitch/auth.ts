import { getApiKeys } from "@/lib/apiKeys";
import type { TwitchTokenResponse } from "./types";

let cachedToken: { token: string; expiresAt: number; clientId: string } | null = null;

export async function getTwitchToken(): Promise<string> {
  const keys = await getApiKeys();
  const clientId = keys.twitchClientId;
  const clientSecret = keys.twitchClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("Twitch API keys not configured. Go to Settings to add your Client ID and Secret.");
  }

  // Invalidate cache if client ID changed (user updated keys)
  if (cachedToken && cachedToken.clientId !== clientId) {
    cachedToken = null;
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitch auth failed (${res.status}). Check your Client ID and Secret in Settings.`);
  }

  const data: TwitchTokenResponse = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    clientId,
  };

  return cachedToken.token;
}
