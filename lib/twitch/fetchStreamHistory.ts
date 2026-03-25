import { prisma } from "@/lib/db";
import { getGamesByIds, getRecentBroadcasts, getVideoGamesFromGQL, parseDuration } from "./client";
import { detectCollabSignals } from "./detectCollabs";

export async function backfillStoredStreamHistoryGameNames(friendId?: number): Promise<number> {
  const missingRows = await prisma.streamHistory.findMany({
    where: {
      ...(friendId !== undefined ? { friendId } : {}),
      gameName: "",
    },
    select: {
      id: true,
      gameId: true,
      videoId: true,
    },
  });

  if (missingRows.length === 0) return 0;

  // Helix lookup for rows that have a gameId
  const rowsWithGameId = missingRows.filter((r) => r.gameId && r.gameId !== "0");
  const gameNameById = await getGamesByIds(rowsWithGameId.map((r) => r.gameId));

  // GQL lookup for rows still without a game name after Helix
  const stillMissing = missingRows.filter((r) => !gameNameById.get(r.gameId));
  const gqlGameByVideoId = await getVideoGamesFromGQL(stillMissing.map((r) => r.videoId));

  let updated = 0;

  for (const row of missingRows) {
    const gameName = gameNameById.get(row.gameId) ?? gqlGameByVideoId.get(row.videoId);
    if (!gameName) continue;

    await prisma.streamHistory.update({
      where: { id: row.id },
      data: { gameName },
    });
    updated++;
  }

  return updated;
}

/** Fetch and store the last `count` broadcasts for a friend. Accumulates — never deletes old records. */
export async function fetchAndStoreStreamHistory(
  friendId: number,
  twitchId: string,
  count = 100
): Promise<number> {
  const videos = await getRecentBroadcasts(twitchId, Math.min(count, 100));
  if (videos.length === 0) return 0;
  const gameNameById = await getGamesByIds(videos.map((video) => video.game_id ?? ""));

  // For VODs that still have no game after the Helix lookup, try GQL chapter markers
  const noGameVideoIds = videos
    .filter((v) => !v.game_name && !gameNameById.get(v.game_id ?? ""))
    .map((v) => v.id);
  const gqlGameByVideoId = await getVideoGamesFromGQL(noGameVideoIds);

  let stored = 0;
  for (const v of videos) {
    const durationSec = parseDuration(v.duration);
    const startTime = new Date(v.created_at);
    const endTime = new Date(startTime.getTime() + durationSec * 1000);
    const gameName = v.game_name ?? gameNameById.get(v.game_id ?? "") ?? gqlGameByVideoId.get(v.id) ?? "";

    try {
      await prisma.streamHistory.upsert({
        where: { friendId_videoId: { friendId, videoId: v.id } },
        create: {
          friendId,
          videoId: v.id,
          title: v.title,
          startTime,
          endTime,
          durationSec,
          gameName,
          gameId: v.game_id ?? "",
        },
        update: {
          title: v.title,
          startTime,
          endTime,
          durationSec,
          gameName,
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

  await backfillStoredStreamHistoryGameNames(friendId);

  return stored;
}
