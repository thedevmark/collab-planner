import { prisma } from "@/lib/db";

export interface ApiKeys {
  twitchClientId: string;
  twitchClientSecret: string;
  geminiApiKey: string;
}

let cached: { keys: ApiKeys; fetchedAt: number } | null = null;
const CACHE_TTL = 60_000; // 1 minute

/**
 * Reads API keys from the database Settings table,
 * falling back to environment variables.
 * Cached for 1 minute to avoid hitting the DB on every API call.
 */
export async function getApiKeys(): Promise<ApiKeys> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.keys;
  }

  let settings: { twitchClientId: string; twitchClientSecret: string; geminiApiKey: string } | null = null;
  try {
    settings = await prisma.settings.findFirst({
      select: { twitchClientId: true, twitchClientSecret: true, geminiApiKey: true },
    });
  } catch {
    // DB not ready yet, fall through to env vars
  }

  const keys: ApiKeys = {
    twitchClientId: settings?.twitchClientId || process.env.TWITCH_CLIENT_ID || "",
    twitchClientSecret: settings?.twitchClientSecret || process.env.TWITCH_CLIENT_SECRET || "",
    geminiApiKey: settings?.geminiApiKey || process.env.GEMINI_API_KEY || "",
  };

  cached = { keys, fetchedAt: Date.now() };
  return keys;
}

/** Clear the cached keys (call after saving new keys). */
export function clearApiKeyCache() {
  cached = null;
}
