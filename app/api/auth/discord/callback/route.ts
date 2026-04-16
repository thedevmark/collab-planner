import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  clearDiscordOAuthState,
  hasValidDiscordOAuthState,
} from "@/lib/discord/oauthState";
import { getGuilds, getGuildChannels } from "@/lib/discord/client";

interface DiscordWebhookResponse {
  url: string;
  channel_id: string;
  guild_id: string;
}

/**
 * Best-effort resolution of human-readable server/channel names for display.
 * Returns nulls on any failure — we already have the IDs, so the integration
 * works regardless of whether this succeeds.
 */
async function resolveWebhookNames(
  accessToken: string,
  guildId: string,
  channelId: string,
): Promise<{ guildName: string | null; channelName: string | null }> {
  try {
    const [guilds, channels] = await Promise.all([
      getGuilds(accessToken).catch(() => []),
      getGuildChannels(guildId, accessToken).catch(() => []),
    ]);
    return {
      guildName: guilds.find((g) => g.id === guildId)?.name ?? null,
      channelName: channels.find((c) => c.id === channelId)?.name ?? null,
    };
  } catch {
    return { guildName: null, channelName: null };
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const returnedState = searchParams.get("state");

  if (error || !code || !hasValidDiscordOAuthState(req, returnedState)) {
    const response = NextResponse.redirect(new URL("/settings?discord=canceled", req.url));
    clearDiscordOAuthState(response);
    return response;
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
    });

    if (!tokenRes.ok) throw new Error("Token exchange failed");
    const tokens = await tokenRes.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Get Discord user info
    const meRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!meRes.ok) throw new Error("Failed to fetch Discord user");
    const me = await meRes.json();

    const discordUsername = me.global_name ?? me.username;

    // If the user approved `webhook.incoming`, Discord returns a ready-to-use
    // webhook object keyed on `webhook` in the token response. When present
    // we store its URL + server/channel metadata so notifications work with
    // zero extra setup on the user's side.
    const webhook = tokens.webhook as DiscordWebhookResponse | undefined;
    const names = webhook
      ? await resolveWebhookNames(tokens.access_token, webhook.guild_id, webhook.channel_id)
      : { guildName: null, channelName: null };

    const profile = await prisma.profile.update({
      where: { id: user.id },
      data: {
        discordId: me.id,
        discordUsername,
        discordAccessToken: tokens.access_token,
        discordRefreshToken: tokens.refresh_token,
        discordTokenExpiry: expiresAt,
        ...(webhook && {
          discordWebhookUrl: webhook.url,
          discordGuildId: webhook.guild_id,
          discordChannelId: webhook.channel_id,
          discordGuildName: names.guildName,
          discordChannelName: names.channelName,
        }),
      },
      select: { twitchId: true },
    });

    // Fire-and-forget — never block the OAuth redirect
    prisma.friend.updateMany({
      where: { twitchId: profile.twitchId, discordUsername: null },
      data: { discordUsername, discordId: me.id },
    }).catch(() => {});

    const response = NextResponse.redirect(new URL("/settings?discord=connected", req.url));
    clearDiscordOAuthState(response);
    return response;
  } catch {
    const response = NextResponse.redirect(new URL("/settings?discord=error", req.url));
    clearDiscordOAuthState(response);
    return response;
  }
}
