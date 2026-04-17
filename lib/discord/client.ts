import { prisma } from "@/lib/db";
import { formatDateTime } from "./templates";

const DISCORD_API = "https://discord.com/api/v10";
const TWITCH_PURPLE = 0x9147ff;

// ── Token management ────────────────────────────────────────────────────────

export async function getDiscordToken(userId: string): Promise<string | null> {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { discordAccessToken: true, discordRefreshToken: true, discordTokenExpiry: true },
  });
  if (!profile?.discordAccessToken || !profile?.discordRefreshToken) return null;

  const fiveMinutes = 5 * 60 * 1000;
  const expiresAt = profile.discordTokenExpiry;
  if (!expiresAt || expiresAt.getTime() - Date.now() < fiveMinutes) {
    return refreshDiscordToken(userId, profile.discordRefreshToken);
  }

  return profile.discordAccessToken;
}

async function refreshDiscordToken(userId: string, refreshToken: string): Promise<string | null> {
  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    // Refresh token invalid — clear Discord data so user reconnects
    await prisma.profile.update({
      where: { id: userId },
      data: { discordAccessToken: null, discordRefreshToken: null, discordTokenExpiry: null },
    });
    return null;
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await prisma.profile.update({
    where: { id: userId },
    data: {
      discordAccessToken: data.access_token,
      discordRefreshToken: data.refresh_token,
      discordTokenExpiry: expiresAt,
    },
  });

  return data.access_token;
}

// ── Base fetch ───────────────────────────────────────────────────────────────

// Error subclass so callers can do `err instanceof DiscordApiError` and branch
// on `status` instead of parsing string messages. Useful for 403 (missing
// permission) which we want to surface to the user as a specific note rather
// than a generic failure.
export class DiscordApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Discord ${status}: ${body}`);
    this.name = "DiscordApiError";
    this.status = status;
    this.body = body;
  }
}

async function discordFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new DiscordApiError(res.status, text);
  }

  return res.status === 204 ? null : res.json();
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function getGuilds(token: string): Promise<DiscordGuild[]> {
  return discordFetch("/users/@me/guilds", token);
}

export async function getGuildChannels(guildId: string, token: string): Promise<DiscordChannel[]> {
  return discordFetch(`/guilds/${guildId}/channels`, token);
}


export async function createGuildScheduledEvent(
  guildId: string,
  token: string,
  data: { name: string; startTime: string; endTime: string; description?: string; image?: string }
): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    name: data.name,
    scheduled_start_time: data.startTime,
    scheduled_end_time: data.endTime,
    privacy_level: 2, // GUILD_ONLY
    entity_type: 3,   // EXTERNAL (Twitch stream, not a voice channel)
    entity_metadata: { location: "Twitch" },
    description: data.description ?? "",
  };
  // `image` must be a data URI like `data:image/png;base64,<…>`. Discord caps
  // the file at ~10 MB; the encoded string inflates ~33 % so keep sources
  // small. Omitted entirely if the caller didn't pass one so we don't send
  // an empty field.
  if (data.image) body.image = data.image;
  return discordFetch(`/guilds/${guildId}/scheduled-events`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Patch an existing guild scheduled event. Discord accepts partial updates, so
 * only pass fields that actually changed — matching-value patches are still
 * network traffic but don't cause errors.
 *
 * For EXTERNAL events (entity_type 3, our case) Discord requires
 * scheduled_end_time any time scheduled_start_time moves, otherwise the
 * validation fails. Callers pass both together.
 */
export async function updateGuildScheduledEvent(
  guildId: string,
  eventId: string,
  token: string,
  data: { name?: string; startTime?: string; endTime?: string; description?: string; status?: "scheduled" | "active" | "completed" | "canceled" },
) {
  const body: Record<string, unknown> = {};
  if (data.name !== undefined) body.name = data.name;
  if (data.description !== undefined) body.description = data.description;
  if (data.startTime !== undefined) body.scheduled_start_time = data.startTime;
  if (data.endTime !== undefined) body.scheduled_end_time = data.endTime;
  if (data.status !== undefined) {
    // Discord status enum: 1 scheduled, 2 active, 3 completed, 4 canceled
    body.status = data.status === "scheduled" ? 1 : data.status === "active" ? 2 : data.status === "completed" ? 3 : 4;
  }
  return discordFetch(`/guilds/${guildId}/scheduled-events/${eventId}`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteGuildScheduledEvent(
  guildId: string,
  eventId: string,
  token: string,
) {
  return discordFetch(`/guilds/${guildId}/scheduled-events/${eventId}`, token, {
    method: "DELETE",
  });
}

/**
 * Fetch metadata for a Discord webhook by calling its public info endpoint.
 * The webhook token in the URL is the authentication — no OAuth required.
 *
 * Returns the server (guild_id) and channel_id the webhook posts to, which
 * we store so scheduled-event creation knows which server to target. Returns
 * null if the URL doesn't parse or Discord rejects it (invalid/revoked
 * webhook).
 */
export async function resolveWebhookMetadata(
  webhookUrl: string,
): Promise<{ guildId: string; channelId: string } | null> {
  const match = webhookUrl.match(
    /^https:\/\/(?:(?:ptb|canary)\.)?discord\.com\/api\/webhooks\/(\d+)\/([\w-]+)/,
  );
  if (!match) return null;
  const [, id, token] = match;

  try {
    const res = await fetch(`${DISCORD_API}/webhooks/${id}/${token}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.guild_id || !data.channel_id) return null;
    return { guildId: data.guild_id, channelId: data.channel_id };
  } catch {
    return null;
  }
}

export async function postWebhookMessage(webhookUrl: string, embed: object, content?: string) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed], ...(content && { content }) }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webhook ${res.status}: ${text}`);
  }
}

// ── Embed builders ───────────────────────────────────────────────────────────

interface EventEmbedData {
  title: string;
  startTime: Date;
  endTime?: Date;
  gameName?: string;
  participants: string[];
  timezone: string;
}

export function buildNewEventEmbed(data: EventEmbedData) {
  const fields = [
    { name: "📅 When", value: formatDateTime(data.startTime, data.timezone), inline: false },
    ...(data.gameName ? [{ name: "🎮 Game", value: data.gameName, inline: true }] : []),
    ...(data.participants.length > 0
      ? [{ name: "👥 With", value: data.participants.join(", "), inline: true }]
      : []),
  ];
  return {
    title: `🎮 Collab Planned: ${data.title}`,
    color: TWITCH_PURPLE,
    fields,
    footer: { text: "Collab Planner" },
    timestamp: data.startTime.toISOString(),
  };
}

export function buildConfirmedEmbed(data: EventEmbedData) {
  const fields = [
    { name: "📅 When", value: formatDateTime(data.startTime, data.timezone), inline: false },
    ...(data.gameName ? [{ name: "🎮 Game", value: data.gameName, inline: true }] : []),
    ...(data.participants.length > 0
      ? [{ name: "👥 With", value: data.participants.join(", "), inline: true }]
      : []),
  ];
  return {
    title: `✅ Collab Confirmed: ${data.title}`,
    color: 0x57f287, // Discord green
    fields,
    footer: { text: "Collab Planner" },
    timestamp: data.startTime.toISOString(),
  };
}

export function buildReminderEmbed(data: EventEmbedData & { label: string }) {
  const fields = [
    { name: "📅 When", value: formatDateTime(data.startTime, data.timezone), inline: false },
    ...(data.gameName ? [{ name: "🎮 Game", value: data.gameName, inline: true }] : []),
    ...(data.participants.length > 0
      ? [{ name: "👥 With", value: data.participants.join(", "), inline: true }]
      : []),
  ];
  return {
    title: `⏰ Reminder (${data.label}): ${data.title}`,
    color: 0xfee75c, // Discord yellow
    fields,
    footer: { text: "Collab Planner" },
    timestamp: data.startTime.toISOString(),
  };
}

export function buildCanceledEmbed(data: { title: string }) {
  return {
    title: `❌ Collab Canceled: ${data.title}`,
    color: 0xed4245, // Discord red
    footer: { text: "Collab Planner" },
    timestamp: new Date().toISOString(),
  };
}

interface InviteEmbedData {
  title: string;
  gameName?: string;
  message?: string;
  participants: string[];
  inviteUrl: string;
  expiresAt: Date;
  timezone: string;
}

export function buildInviteEmbed(data: InviteEmbedData) {
  const fields = [
    { name: "🔗 Link", value: `[Open invite](${data.inviteUrl})`, inline: false },
    ...(data.gameName ? [{ name: "🎮 Game", value: data.gameName, inline: true }] : []),
    ...(data.participants.length > 0
      ? [{ name: "👥 Invited", value: data.participants.join(", "), inline: true }]
      : []),
    { name: "⏳ Expires", value: formatDateTime(data.expiresAt, data.timezone), inline: false },
    ...(data.message ? [{ name: "💬 Message", value: data.message }] : []),
  ];
  return {
    title: `🔗 Collab Invite: ${data.title}`,
    color: TWITCH_PURPLE,
    fields,
    footer: { text: "Collab Planner · Smart Links" },
    timestamp: new Date().toISOString(),
  };
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0 = text, 5 = announcement
  position: number;
}
