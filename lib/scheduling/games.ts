import { prisma } from "@/lib/db";

export interface SuggestedGame {
  name: string;
  /** Total sessions played across all selected friends */
  totalSessions: number;
  /** How many of the selected friends have played it */
  friendCount: number;
  /** How many selected friends have played it recently */
  recentFriendCount: number;
  /** Recency- and support-aware ranking score */
  score: number;
  /** Why the game is being surfaced */
  bucket: "everyone" | "group" | "wildcard";
  /** Most recent stream date across the selected friends */
  lastPlayedAt: string;
  /** Per-friend session counts */
  byFriend: Array<{ friendId: number; displayName: string; sessions: number }>;
}

const RECENT_WINDOW_DAYS = 60;
const STALE_WINDOW_DAYS = 180;
const MAX_SUPPORT_SESSIONS = 8;

/**
 * Returns games ranked by group coverage first, then recency and support.
 * Strong consensus picks surface above old one-off titles, while still leaving
 * room for recent wildcard picks when overlap is sparse.
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

  const history = await prisma.streamHistory.findMany({
    where: {
      friendId: { in: ownedIds },
      gameName: { not: "" },
    },
    select: {
      friendId: true,
      gameName: true,
      startTime: true,
    },
    orderBy: { startTime: "desc" },
  });

  if (history.length === 0) return [];

  const now = Date.now();
  const recentCutoff = now - RECENT_WINDOW_DAYS * 86400000;
  const staleCutoff = now - STALE_WINDOW_DAYS * 86400000;

  const gameMap = new Map<string, {
    lastPlayedAt: Date;
    perFriend: Map<number, { sessions: number; recentSessions: number; weightedScore: number; lastPlayedAt: Date }>;
  }>();

  for (const row of history) {
    const name = row.gameName.trim();
    if (!name) continue;

    const playedAt = new Date(row.startTime);
    const ageDays = Math.max(0, (now - playedAt.getTime()) / 86400000);
    const recencyWeight = 0.25 + 0.75 * Math.exp(-ageDays / 45);
    const gameEntry = gameMap.get(name) ?? {
      lastPlayedAt: playedAt,
      perFriend: new Map<number, { sessions: number; recentSessions: number; weightedScore: number; lastPlayedAt: Date }>(),
    };

    const friendEntry = gameEntry.perFriend.get(row.friendId) ?? {
      sessions: 0,
      recentSessions: 0,
      weightedScore: 0,
      lastPlayedAt: playedAt,
    };

    friendEntry.sessions += 1;
    friendEntry.weightedScore += recencyWeight;
    if (playedAt.getTime() >= recentCutoff) {
      friendEntry.recentSessions += 1;
    }
    if (playedAt > friendEntry.lastPlayedAt) {
      friendEntry.lastPlayedAt = playedAt;
    }

    gameEntry.perFriend.set(row.friendId, friendEntry);
    if (playedAt > gameEntry.lastPlayedAt) {
      gameEntry.lastPlayedAt = playedAt;
    }

    gameMap.set(name, gameEntry);
  }

  const suggestions: SuggestedGame[] = [];
  const groupSize = ownedIds.length;

  for (const [name, stats] of gameMap) {
    const byFriend = ownedIds.flatMap((id) => {
      const friendStats = stats.perFriend.get(id);
      if (!friendStats) return [];
      return [{
        friendId: id,
        displayName: nameMap.get(id) ?? String(id),
        sessions: friendStats.sessions,
      }];
    });

    const friendCount = byFriend.length;
    const totalSessions = byFriend.reduce((sum, friend) => sum + friend.sessions, 0);
    const recentFriendCount = ownedIds.filter((id) => {
      const friendStats = stats.perFriend.get(id);
      return (friendStats?.recentSessions ?? 0) > 0;
    }).length;

    const weightedRecency = Array.from(stats.perFriend.values())
      .reduce((sum, friendStats) => sum + friendStats.weightedScore, 0);
    const coverage = friendCount / groupSize;
    const recentCoverage = recentFriendCount / groupSize;
    const support = Math.min(totalSessions, MAX_SUPPORT_SESSIONS) / MAX_SUPPORT_SESSIONS;
    const stalePenalty = stats.lastPlayedAt.getTime() < staleCutoff ? 0.72 : 1;

    const bucket: SuggestedGame["bucket"] =
      friendCount === groupSize
        ? "everyone"
        : friendCount >= Math.max(2, Math.ceil(groupSize * 0.6))
          ? "group"
          : "wildcard";

    const bucketBoost =
      bucket === "everyone"
        ? 0.16
        : bucket === "group"
          ? 0.08
          : 0;

    const score =
      (
        coverage * 0.48 +
        recentCoverage * 0.22 +
        Math.min(weightedRecency / Math.max(groupSize, 1), 1.2) * 0.2 +
        support * 0.1 +
        bucketBoost
      ) * stalePenalty;

    const onlyOneOldSession =
      totalSessions === 1 &&
      friendCount === 1 &&
      stats.lastPlayedAt.getTime() < recentCutoff;

    if (onlyOneOldSession) {
      continue;
    }

    suggestions.push({
      name,
      friendCount,
      totalSessions,
      recentFriendCount,
      score,
      bucket,
      lastPlayedAt: stats.lastPlayedAt.toISOString(),
      byFriend,
    });
  }

  // Sort: strongest group fit first, then support and recency.
  suggestions.sort(
    (a, b) =>
      b.score - a.score ||
      b.friendCount - a.friendCount ||
      b.recentFriendCount - a.recentFriendCount ||
      b.totalSessions - a.totalSessions ||
      new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime()
  );

  return suggestions.slice(0, 20);
}
