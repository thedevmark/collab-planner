import { getTwitchToken } from "./auth";
import type {
  TwitchUser,
  TwitchSchedule,
  TwitchGame,
  TwitchVideo,
  TwitchChannel,
  TwitchFollower,
  TwitchFollowedChannel,
  TwitchStream,
} from "./types";

const TWITCH_API = "https://api.twitch.tv/helix";

async function twitchFetch<T>(path: string): Promise<T> {
  const token = await getTwitchToken();
  const clientId = process.env.TWITCH_CLIENT_ID!;

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

async function twitchUserFetch<T>(path: string, userToken: string): Promise<T> {
  const clientId = process.env.TWITCH_CLIENT_ID!;

  const res = await fetch(`${TWITCH_API}${path}`, {
    headers: {
      Authorization: `Bearer ${userToken}`,
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

export async function getUsersByIds(ids: string[]): Promise<TwitchUser[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const users: TwitchUser[] = [];

  for (let i = 0; i < uniqueIds.length; i += 100) {
    const chunk = uniqueIds.slice(i, i + 100);
    const query = chunk.map((id) => `id=${encodeURIComponent(id)}`).join("&");
    const data = await twitchFetch<{ data: TwitchUser[] }>(`/users?${query}`);
    users.push(...(data.data ?? []));
  }

  return users;
}

export async function getUsersByLogins(logins: string[]): Promise<TwitchUser[]> {
  const uniqueLogins = [...new Set(logins.map((login) => login.trim().toLowerCase()).filter(Boolean))];
  const users: TwitchUser[] = [];

  for (let i = 0; i < uniqueLogins.length; i += 100) {
    const chunk = uniqueLogins.slice(i, i + 100);
    const query = chunk.map((login) => `login=${encodeURIComponent(login)}`).join("&");
    const data = await twitchFetch<{ data: TwitchUser[] }>(`/users?${query}`);
    users.push(...(data.data ?? []));
  }

  return users;
}

/**
 * Returns the live stream for a user if they're currently broadcasting,
 * or null if offline. Helix returns an empty `data` array for offline users
 * rather than a 404.
 */
export async function getStreamByUserId(userId: string): Promise<TwitchStream | null> {
  const data = await twitchFetch<{ data: TwitchStream[] }>(`/streams?user_id=${userId}`);
  const stream = data.data?.[0];
  return stream && stream.type === "live" ? stream : null;
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

export async function searchChannels(query: string): Promise<TwitchChannel[]> {
  const data = await twitchFetch<{ data: TwitchChannel[] }>(
    `/search/channels?query=${encodeURIComponent(query)}&first=8`
  );
  return data.data;
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

export async function getGamesByIds(gameIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(gameIds.filter((id) => id && id !== "0"))];
  if (uniqueIds.length === 0) return new Map();

  const games: TwitchGame[] = [];

  for (let i = 0; i < uniqueIds.length; i += 100) {
    const chunk = uniqueIds.slice(i, i + 100);
    const query = chunk.map((id) => `id=${encodeURIComponent(id)}`).join("&");
    const data = await twitchFetch<{ data: TwitchGame[] }>(`/games?${query}`);
    games.push(...(data.data ?? []));
  }

  return new Map(games.map((game) => [game.id, game.name]));
}

export async function getChannelFollowers(
  broadcasterId: string,
  userToken: string,
  maxFollowers = 500
): Promise<{ followers: TwitchFollower[]; total: number; capped: boolean }> {
  const followers: TwitchFollower[] = [];
  let cursor = "";
  let total = 0;

  do {
    const params = new URLSearchParams({
      broadcaster_id: broadcasterId,
      first: "100",
    });
    if (cursor) params.set("after", cursor);

    const data = await twitchUserFetch<{
      total?: number;
      data?: TwitchFollower[];
      pagination?: { cursor?: string };
    }>(`/channels/followers?${params.toString()}`, userToken);

    total = data.total ?? total;
    followers.push(...(data.data ?? []));
    cursor = data.pagination?.cursor ?? "";
  } while (cursor && followers.length < maxFollowers);

  return {
    followers: followers.slice(0, maxFollowers),
    total,
    capped: Boolean(cursor),
  };
}

export async function getFollowedChannels(
  userId: string,
  userToken: string,
  maxChannels = 500
): Promise<{ channels: TwitchFollowedChannel[]; total: number; capped: boolean }> {
  const channels: TwitchFollowedChannel[] = [];
  let cursor = "";
  let total = 0;

  do {
    const params = new URLSearchParams({
      user_id: userId,
      first: "100",
    });
    if (cursor) params.set("after", cursor);

    const data = await twitchUserFetch<{
      total?: number;
      data?: TwitchFollowedChannel[];
      pagination?: { cursor?: string };
    }>(`/channels/followed?${params.toString()}`, userToken);

    total = data.total ?? total;
    channels.push(...(data.data ?? []));
    cursor = data.pagination?.cursor ?? "";
  } while (cursor && channels.length < maxChannels);

  return {
    channels: channels.slice(0, maxChannels),
    total,
    capped: Boolean(cursor),
  };
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

/**
 * Fetch the primary game for a batch of VODs via Twitch GQL chapter markers.
 * The Helix /videos endpoint rarely returns game_id for archived streams;
 * GQL chapters are the only reliable source for this data.
 *
 * Returns a Map<videoId, gameName>. Videos with no chapter data are omitted.
 */
export async function getVideoGamesFromGQL(videoIds: string[]): Promise<Map<string, string>> {
  if (videoIds.length === 0) return new Map();

  // Build a batched GQL query using aliases: v_<id>: video(id: "<id>") { ... }
  const aliases = videoIds.map(
    (id) => `v_${id}: video(id: "${id}") {
      moments(momentRequestType: VIDEO_CHAPTER_MARKERS) {
        edges { node { details { ... on GameChangeMoment { game { displayName } } } } }
      }
    }`
  ).join("\n");

  try {
    const res = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: {
        "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: `{ ${aliases} }` }),
    });
    if (!res.ok) return new Map();
    const json = await res.json();
    const result = new Map<string, string>();
    for (const id of videoIds) {
      const videoData = json?.data?.[`v_${id}`];
      const firstEdge = videoData?.moments?.edges?.[0];
      const gameName = firstEdge?.node?.details?.game?.displayName;
      if (gameName) result.set(id, gameName);
    }
    return result;
  } catch {
    return new Map();
  }
}

/**
 * Fetch a streamer's channel brand color (the accent color on their Twitch channel page)
 * via Twitch's GQL API. Returns a "#RRGGBB" hex string or "".
 *
 * The official Helix API does not expose this field — GQL is the only public source.
 * Uses Twitch's own website Client-Id which is publicly accessible.
 */
export async function getChatColor(login: string): Promise<string> {
  try {
    const res = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: {
        "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: `{ user(login: "${login}") { primaryColorHex } }` }),
    });
    if (!res.ok) return "";
    const json = await res.json();
    const hex = json?.data?.user?.primaryColorHex ?? "";
    return hex ? `#${hex}` : "";
  } catch {
    return "";
  }
}
