import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTwitchToken } from "@/lib/twitch/auth";
import { getApiKeys } from "@/lib/apiKeys";

export async function GET() {
  try {
    const friends = await prisma.friend.findMany({
      where: { isActive: true, isMe: false },
      select: { id: true, twitchId: true, username: true, displayName: true, avatarUrl: true, channelColor: true },
    });

    if (friends.length === 0) return NextResponse.json({ live: [] });

    const token = await getTwitchToken();
    const keys = await getApiKeys();

    // Fetch live status for all friends in one request (up to 100 user_ids)
    const params = friends.map((f) => `user_id=${encodeURIComponent(f.twitchId)}`).join("&");
    const res = await fetch(`https://api.twitch.tv/helix/streams?${params}&first=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": keys.twitchClientId,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ live: [] });
    }

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
