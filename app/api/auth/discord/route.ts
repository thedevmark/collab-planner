import { NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { issueDiscordOAuthState } from "@/lib/discord/oauthState";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const state = await issueDiscordOAuthState();
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    response_type: "code",
    // `webhook.incoming` triggers Discord's native server+channel picker during
    // the OAuth consent screen and returns a fully-formed webhook in the token
    // response — no raw-URL paste, no picker UI on our side.
    scope: "identify guilds webhook.incoming",
    // `prompt=consent` forces the picker every time even for already-authorized
    // users, so "Change channel" works without the user wondering why nothing
    // happened when they re-clicked Connect.
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(
    `https://discord.com/oauth2/authorize?${params.toString()}`
  );
}
