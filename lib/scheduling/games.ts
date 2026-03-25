import { prisma } from "@/lib/db";

export interface SuggestedGame {
  name: string;
  /** Total sessions played across all selected friends */
  totalSessions: number;
  /** How many of the selected friends have played it */
  friendCount: number;
  /** Per-friend session counts */
  byFriend: Array<{ friendId: number; displayName: string; sessions: number }>;
}

/**
 * Returns games ranked by how many selected friends have played them,
 * then by total session count. Games ALL friends have played rank first
 * (intersection), then games some have played (union).
 *
 * Queries the accumulated StreamHistory — no AI involved.
 */
export async function getSuggestedGames(
  friendIds: number[],
  userId: string
): Promise<SuggestedGame[]> {
  if (friendIds.length === 0) return [];

  // Verify ownership and get display names in one query
  const friends = await prisma.friend.findMany({
    where: { id: { in: friendIds }, userId },
    select: { id: true, displayName: true },
  });

  if (friends.length === 0) return [];

  const ownedIds = friends.map((f) => f.id);
  const nameMap = new Map(friends.map((f) => [f.id, f.displayName]));

  // Pull game counts from stream history
  const rows = await prisma.streamHistory.groupBy({
    by: ["friendId", "gameName"],
    where: {
      friendId: { in: ownedIds },
      gameName: { not: "" },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  // Build a map: gameName → { friendId → count }
  const gameMap = new Map<string, Map<number, number>>();
  for (const row of rows) {
    if (!row.gameName) continue;
    if (!gameMap.has(row.gameName)) gameMap.set(row.gameName, new Map());
    gameMap.get(row.gameName)!.set(row.friendId, row._count.id);
  }

  const suggestions: SuggestedGame[] = [];

  for (const [name, friendCounts] of gameMap) {
    const byFriend = ownedIds
      .filter((id) => friendCounts.has(id))
      .map((id) => ({
        friendId: id,
        displayName: nameMap.get(id) ?? String(id),
        sessions: friendCounts.get(id)!,
      }));

    suggestions.push({
      name,
      friendCount: byFriend.length,
      totalSessions: byFriend.reduce((sum, f) => sum + f.sessions, 0),
      byFriend,
    });
  }

  // Sort: most friends first, then most total sessions
  suggestions.sort(
    (a, b) =>
      b.friendCount - a.friendCount ||
      b.totalSessions - a.totalSessions
  );

  return suggestions.slice(0, 20);
}
