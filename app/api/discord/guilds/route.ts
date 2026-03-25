import { NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { getDiscordToken, getGuilds } from "@/lib/discord/client";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const token = await getDiscordToken(user.id);
    if (!token) return NextResponse.json({ error: "Discord not connected" }, { status: 401 });

    const guilds = await getGuilds(token);

    // Return only guilds where the user is owner or has MANAGE_EVENTS (bit 33 = 0x200000000)
    // For simplicity, show all guilds and let Discord enforce permissions on event creation
    const sorted = guilds
      .sort((a, b) => (b.owner ? 1 : 0) - (a.owner ? 1 : 0))
      .map(({ id, name, icon, owner }) => ({ id, name, icon, owner }));

    return NextResponse.json({ guilds: sorted });
  } catch {
    return NextResponse.json({ error: "Failed to fetch guilds" }, { status: 500 });
  }
}
