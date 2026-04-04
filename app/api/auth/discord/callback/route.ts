import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/settings?discord=canceled", req.url));
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

    const profile = await prisma.profile.update({
      where: { id: user.id },
      data: {
        discordId: me.id,
        discordUsername,
        discordAccessToken: tokens.access_token,
        discordRefreshToken: tokens.refresh_token,
        discordTokenExpiry: expiresAt,
      },
      select: { twitchId: true },
    });

    // Fire-and-forget — never block the OAuth redirect
    prisma.friend.updateMany({
      where: { twitchId: profile.twitchId, discordUsername: null },
      data: { discordUsername },
    }).catch(() => {});

    return NextResponse.redirect(new URL("/settings?discord=connected", req.url));
  } catch {
    return NextResponse.redirect(new URL("/settings?discord=error", req.url));
  }
}
