import { NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    response_type: "code",
    scope: "identify guilds",
  });

  return NextResponse.redirect(
    `https://discord.com/oauth2/authorize?${params.toString()}`
  );
}
