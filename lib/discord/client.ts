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
    throw new Error(`Discord ${res.status}: ${text}`);
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
  data: { name: string; startTime: string; endTime: string; description?: string }
) {
  return discordFetch(`/guilds/${guildId}/scheduled-events`, token, {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      scheduled_start_time: data.startTime,
      scheduled_end_time: data.endTime,
      privacy_level: 2, // GUILD_ONLY
      entity_type: 3,   // EXTERNAL (Twitch stream, not a voice channel)
      entity_metadata: { location: "Twitch" },
      description: data.description ?? "",
    }),
  });
}

export async function postChannelMessage(channelId: string, token: string, embed: object) {
  return discordFetch(`/channels/${channelId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ embeds: [embed] }),
  });
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
