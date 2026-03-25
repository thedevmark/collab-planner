import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { getTwitchToken } from "@/lib/twitch/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const userId = user.id;

  try {
    const friends = await prisma.friend.findMany({
      where: { isActive: true, isMe: false, userId },
      select: { id: true, twitchId: true, username: true, displayName: true, avatarUrl: true, channelColor: true },
    });

    if (friends.length === 0) return NextResponse.json({ live: [] });

    const token = await getTwitchToken();
    const clientId = process.env.TWITCH_CLIENT_ID!;

    const params = friends.map((f) => `user_id=${encodeURIComponent(f.twitchId)}`).join("&");
    const res = await fetch(`https://api.twitch.tv/helix/streams?${params}&first=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": clientId,
      },
    });

    if (!res.ok) return NextResponse.json({ live: [] });

    const data: { data: { user_id: string; user_name: string; game_name: string; title: string; viewer_count: number }[] } = await res.json();
    const liveIds = new Set(data.data.map((s) => s.user_id));

    const live = friends
      .filter((f) => liveIds.has(f.twitchId))
      .map((f) => {
        const stream = data.data.find((s) => s.user_id === f.twitchId)!;
        return {
          id: f.id,
          username: f.username,
          displayName: f.displayName,
          avatarUrl: f.avatarUrl,
          channelColor: f.channelColor,
          gameName: stream.game_name,
          title: stream.title,
          viewerCount: stream.viewer_count,
        };
      });

    return NextResponse.json({ live });
  } catch (err) {
    return NextResponse.json({ live: [] });
  }
}
