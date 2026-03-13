import { prisma } from "@/lib/db";
import { getRecentBroadcasts, parseDuration } from "./client";
import { detectCollabSignals } from "./detectCollabs";

/** Fetch and store the last `count` broadcasts for a friend. Skips already-stored videos. */
export async function fetchAndStoreStreamHistory(
  friendId: number,
  twitchId: string,
  count = 20
): Promise<number> {
  const videos = await getRecentBroadcasts(twitchId, count);
  if (videos.length === 0) return 0;

  let stored = 0;
  for (const v of videos) {
    const durationSec = parseDuration(v.duration);
    const startTime = new Date(v.created_at);
    const endTime = new Date(startTime.getTime() + durationSec * 1000);

    try {
      await prisma.streamHistory.upsert({
        where: { videoId: v.id },
        create: {
          friendId,
          videoId: v.id,
          title: v.title,
          startTime,
          endTime,
          durationSec,
          gameName: v.game_name ?? "",
          gameId: v.game_id ?? "",
        },
        update: {
          gameName: v.game_name ?? "",
          gameId: v.game_id ?? "",
        },
      });
      stored++;
    } catch {
      // Skip duplicates or errors
    }
  }

  // After storing new history, re-run collab detection (fire-and-forget)
  if (stored > 0) {
    detectCollabSignals(friendId).catch(() => {});
  }

  return stored;
}
