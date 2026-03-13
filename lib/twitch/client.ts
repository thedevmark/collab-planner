import { getTwitchToken } from "./auth";
import { getApiKeys } from "@/lib/apiKeys";
import type { TwitchUser, TwitchSchedule, TwitchGame, TwitchVideo } from "./types";

const TWITCH_API = "https://api.twitch.tv/helix";

async function twitchFetch<T>(path: string): Promise<T> {
  const token = await getTwitchToken();
  const keys = await getApiKeys();
  const clientId = keys.twitchClientId;

  const res = await fetch(`${TWITCH_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": clientId,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitch API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function getUserByUsername(username: string): Promise<TwitchUser | null> {
  const data = await twitchFetch<{ data: TwitchUser[] }>(`/users?login=${encodeURIComponent(username)}`);
  return data.data[0] ?? null;
}

export async function getUserById(id: string): Promise<TwitchUser | null> {
  const data = await twitchFetch<{ data: TwitchUser[] }>(`/users?id=${id}`);
  return data.data[0] ?? null;
}

export async function getBroadcasterSchedule(broadcasterId: string): Promise<TwitchSchedule | null> {
  try {
    const data = await twitchFetch<{ data: TwitchSchedule }>(
      `/schedule?broadcaster_id=${broadcasterId}&first=25`
    );
    return data.data;
  } catch (err) {
    // 404 means the broadcaster has no schedule set up
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

export async function searchCategories(query: string): Promise<TwitchGame[]> {
  const data = await twitchFetch<{ data: TwitchGame[] }>(
    `/search/categories?query=${encodeURIComponent(query)}&first=10`
  );
  return data.data;
}

export async function getTopGames(first = 20): Promise<TwitchGame[]> {
  const data = await twitchFetch<{ data: TwitchGame[] }>(`/games/top?first=${first}`);
  return data.data;
}

/** Parse Twitch duration string like "3h12m45s" into total seconds */
export function parseDuration(dur: string): number {
  const h = parseInt(dur.match(/(\d+)h/)?.[1] ?? "0");
  const m = parseInt(dur.match(/(\d+)m/)?.[1] ?? "0");
  const s = parseInt(dur.match(/(\d+)s/)?.[1] ?? "0");
  return h * 3600 + m * 60 + s;
}

/** Fetch recent past broadcasts (VODs) for a user. Returns up to `first` videos. */
export async function getRecentBroadcasts(userId: string, first = 20): Promise<TwitchVideo[]> {
  const data = await twitchFetch<{ data: TwitchVideo[] }>(
    `/videos?user_id=${userId}&type=archive&first=${first}`
  );
  return data.data ?? [];
}

/** Fetch a user's publicly-set chat name color (their channel color). Returns hex string or "". */
export async function getChatColor(userId: string): Promise<string> {
  try {
    const data = await twitchFetch<{ data: { user_id: string; user_name: string; color: string }[] }>(
      `/chat/color?user_id=${encodeURIComponent(userId)}`
    );
    return data.data[0]?.color ?? "";
  } catch {
    return "";
  }
}
