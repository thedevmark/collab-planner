import { prisma } from "@/lib/db";

export interface CollabPartner {
  partnerName: string;
  partnerLogin: string;
  detectedAt: Date;
  source: "vod_title_mention" | "stream_overlap";
  evidence: string;
  confidence: "high" | "medium" | "weak";
}

/**
 * Keywords that strongly suggest a collaboration VOD when combined with a name mention.
 * A VOD title matching these patterns + a name is high confidence.
 */
const COLLAB_KEYWORDS = [
  "collab", "collaboration", "ft.", "feat.", "with ", " w/ ", " w/", "guest",
  "duo", "trio", "squad", "together", "joined by", "join", "hosted",
  "stream together", "co-stream", "co stream",
];

/** Minimum overlap window (ms) between two streams to count as a collab signal. */
const MIN_OVERLAP_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Parse @handle mentions from a VOD title.
 * Returns lowercase handles (without the @).
 */
function extractAtMentions(title: string): string[] {
  const matches = title.match(/@([a-zA-Z0-9_]{4,25})/g) ?? [];
  return matches.map((m) => m.slice(1).toLowerCase());
}

/**
 * Does this title contain a collab-suggesting keyword?
 */
function hasCollabKeyword(title: string): boolean {
  const lower = title.toLowerCase();
  return COLLAB_KEYWORDS.some((kw) => lower.includes(kw));
}

function isSelfReference(
  handleOrName: string,
  subject: { username: string; displayName: string },
) {
  const norm = handleOrName.toLowerCase();
  return (
    norm === subject.username.toLowerCase() ||
    norm === subject.displayName.toLowerCase()
  );
}

/**
 * Extract collab signals for a single friend.
 *
 * Sources:
 *   1. `@handle` mentions in a VOD title → high confidence
 *   2. Another friend's name/login in a VOD title plus a collab keyword → high confidence
 *   3. Another friend streamed in an overlapping time window (≥30min) with the same game → high confidence
 *   4. Another friend streamed in an overlapping time window (≥30min) with a different game → medium confidence
 *
 * Bare name-in-title matches WITHOUT a collab keyword are no longer persisted as signals —
 * they produced too many false positives from unrelated titles like "practicing w/ no mic".
 *
 * Self-references are filtered out at every source so a streamer's own VODs don't produce
 * a signal of themselves as a collab partner.
 */
export async function detectCollabSignals(friendId: number): Promise<number> {
  const friend = await prisma.friend.findUnique({
    where: { id: friendId },
    include: {
      streamHistory: { orderBy: { startTime: "desc" }, take: 50 },
    },
  });

  if (!friend || !friend.streamHistory.length) return 0;

  // All other active friends to cross-reference against
  const allFriends = await prisma.friend.findMany({
    where: { isActive: true, id: { not: friendId } },
    include: {
      streamHistory: { orderBy: { startTime: "desc" }, take: 50 },
    },
  });

  const subject = { username: friend.username, displayName: friend.displayName };
  const signals: CollabPartner[] = [];
  const seen = new Set<string>();

  // ── Source 1 & 2: VOD title analysis ─────────────────────────────────────
  for (const vod of friend.streamHistory) {
    const title = vod.title;
    const detectedAt = vod.startTime;

    // 1. @handle mentions
    const atMentions = extractAtMentions(title);
    for (const handle of atMentions) {
      if (isSelfReference(handle, subject)) continue;
      const key = `mention|${handle}|${detectedAt.toDateString()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const matched = allFriends.find(
        (f) =>
          f.username.toLowerCase() === handle ||
          f.displayName.toLowerCase() === handle,
      );

      signals.push({
        partnerName: matched?.displayName ?? `@${handle}`,
        partnerLogin: matched?.username ?? handle,
        detectedAt,
        source: "vod_title_mention",
        evidence: title,
        confidence: "high",
      });
    }

    // 2. Other friend name + collab keyword in title
    if (!hasCollabKeyword(title)) continue;
    for (const other of allFriends) {
      if (isSelfReference(other.username, subject)) continue;
      if (isSelfReference(other.displayName, subject)) continue;
      const lowerTitle = title.toLowerCase();
      const matches =
        lowerTitle.includes(other.username.toLowerCase()) ||
        (other.displayName.length >= 3 && lowerTitle.includes(other.displayName.toLowerCase()));
      if (!matches) continue;

      const key = `mention|${other.username.toLowerCase()}|${detectedAt.toDateString()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      signals.push({
        partnerName: other.displayName,
        partnerLogin: other.username,
        detectedAt,
        source: "vod_title_mention",
        evidence: title,
        confidence: "high",
      });
    }
  }

  // ── Source 3 & 4: Stream overlap detection ───────────────────────────────
  // Twitch doesn't expose a public "guest star" / "collab channels" API, so
  // the strongest non-title signal we can derive is overlapping live windows
  // between two friends, scored higher when they're playing the same game.
  for (const myVod of friend.streamHistory) {
    const myStart = myVod.startTime.getTime();
    const myEnd = myVod.endTime.getTime();
    if (myEnd - myStart < MIN_OVERLAP_MS) continue;

    for (const other of allFriends) {
      if (isSelfReference(other.username, subject)) continue;
      if (isSelfReference(other.displayName, subject)) continue;

      for (const theirVod of other.streamHistory) {
        const theirStart = theirVod.startTime.getTime();
        const theirEnd = theirVod.endTime.getTime();
        const overlap = Math.min(myEnd, theirEnd) - Math.max(myStart, theirStart);
        if (overlap < MIN_OVERLAP_MS) continue;

        const sameGame =
          myVod.gameId && theirVod.gameId && myVod.gameId === theirVod.gameId;
        const detectedAt = new Date(Math.max(myStart, theirStart));
        const key = `overlap|${other.username.toLowerCase()}|${detectedAt.toDateString()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const evidence = sameGame
          ? `Both streamed ${myVod.gameName} for ${Math.round(overlap / 60000)} min`
          : `Overlapping streams for ${Math.round(overlap / 60000)} min`;

        signals.push({
          partnerName: other.displayName,
          partnerLogin: other.username,
          detectedAt,
          source: "stream_overlap",
          evidence,
          confidence: sameGame ? "high" : "medium",
        });
      }
    }
  }

  // ── Persist signals ──────────────────────────────────────────────────────
  let stored = 0;
  for (const s of signals) {
    try {
      await prisma.collabSignal.upsert({
        where: {
          friendId_partnerLogin_detectedAt: {
            friendId,
            partnerLogin: s.partnerLogin,
            detectedAt: s.detectedAt,
          },
        },
        create: {
          friendId,
          partnerName: s.partnerName,
          partnerLogin: s.partnerLogin,
          detectedAt: s.detectedAt,
          source: s.source,
          evidence: s.evidence,
          confidence: s.confidence,
        },
        update: {
          confidence: s.confidence,
          evidence: s.evidence,
          source: s.source,
        },
      });
      stored++;
    } catch {
      // skip constraint violations
    }
  }

  return stored;
}

/**
 * Summarize collab signals for a friend into a human-readable text block.
 */
export interface CollabSummary {
  totalSignals: number;
  partners: {
    name: string;
    login: string;
    count: number;
    lastSeen: Date;
    highConfidenceCount: number;
    sources: string[];
  }[];
  summaryText: string;
}

export function summarizeCollabSignals(
  displayName: string,
  signals: { partnerName: string; partnerLogin: string; detectedAt: Date; source: string; confidence: string }[],
): CollabSummary {
  if (signals.length === 0) {
    return {
      totalSignals: 0,
      partners: [],
      summaryText: `${displayName}: no collab signals detected.`,
    };
  }

  const byPartner = new Map<string, typeof signals>();
  for (const s of signals) {
    const key = (s.partnerLogin || s.partnerName).toLowerCase();
    if (!byPartner.has(key)) byPartner.set(key, []);
    byPartner.get(key)!.push(s);
  }

  const partners = Array.from(byPartner.entries())
    .map(([, sigs]) => ({
      name: sigs[0].partnerName,
      login: sigs[0].partnerLogin,
      count: sigs.length,
      lastSeen: new Date(Math.max(...sigs.map((s) => s.detectedAt.getTime()))),
      highConfidenceCount: sigs.filter((s) => s.confidence === "high").length,
      sources: [...new Set(sigs.map((s) => s.source))],
    }))
    .sort((a, b) => b.count - a.count || b.lastSeen.getTime() - a.lastSeen.getTime());

  const topPartners = partners.slice(0, 5);
  const partnerList = topPartners
    .map((p) => `${p.name} (${p.count}x, last: ${p.lastSeen.toDateString()}, confidence: ${p.highConfidenceCount > 0 ? "high" : "medium"})`)
    .join("; ");

  const summaryText =
    `${displayName} collab history: frequent partners — ${partnerList}. ` +
    `Total signals: ${signals.length} from ${partners.length} unique partners.`;

  return { totalSignals: signals.length, partners, summaryText };
}
