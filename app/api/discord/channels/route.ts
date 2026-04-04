import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { getDiscordToken, getGuildChannels } from "@/lib/discord/client";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const guildId = req.nextUrl.searchParams.get("guildId");
  if (!guildId) return NextResponse.json({ error: "guildId required" }, { status: 400 });

  try {
    const token = await getDiscordToken(user.id);
    if (!token) return NextResponse.json({ error: "Discord not connected" }, { status: 401 });

    const channels = await getGuildChannels(guildId, token);

    // Text (0) and announcement (5) channels only, sorted by position
    const textChannels = channels
      .filter((c) => c.type === 0 || c.type === 5)
      .sort((a, b) => a.position - b.position)
      .map(({ id, name, type }) => ({ id, name, type }));

    return NextResponse.json({ channels: textChannels });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch channels";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
