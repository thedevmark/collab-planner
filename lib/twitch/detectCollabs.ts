import { prisma } from "@/lib/db";

export interface CollabPartner {
  partnerName: string;
  partnerLogin: string;
  detectedAt: Date;
  source: "vod_title_mention" | "concurrent_stream";
  evidence: string;
  confidence: "high" | "medium";
}

/**
 * Keywords that strongly suggest a collaboration VOD when combined with a name mention.
 * A VOD title matching these patterns + a name is HIGH confidence.
 */
const COLLAB_KEYWORDS = [
  "collab", "collaboration", "ft.", "feat.", "with ", " w/ ", " w/", "guest",
  "duo", "trio", "squad", "together", "joined by", "join", "hosted",
  "stream together", "co-stream", "co stream", "@",
];

/**
 * Parse @handle mentions from a VOD title.
 * Returns lowercase handles (without the @).
 */
function extractAtMentions(title: string): string[] {
  const matches = title.match(/@([a-zA-Z0-9_]{4,25})/g) ?? [];
  return matches.map((m) => m.slice(1).toLowerCase());
}

/**
 * Check if a name (login or displayName) appears in a VOD title.
 * Returns the match or empty string.
 */
function nameInTitle(title: string, name: string): boolean {
  if (!name || name.length < 3) return false;
  return title.toLowerCase().includes(name.toLowerCase());
}

/**
 * Does this title contain a collab-suggesting keyword?
 */
function hasCollabKeyword(title: string): boolean {
  const lower = title.toLowerCase();
  return COLLAB_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Extract collab signals from a single friend's VOD history by cross-referencing
 * with all other known friends.
 *
 * Sources:
 * 1. @handle mentions in VOD title → HIGH confidence
 * 2. Friend username/displayName in title + collab keyword → HIGH confidence
 * 3. Friend username/displayName in title alone → MEDIUM confidence
 * 4. Concurrent stream overlap (both streaming at same time for ≥30 min) → MEDIUM confidence
 */
export async function detectCollabSignals(friendId: number): Promise<number> {
  const friend = await prisma.friend.findUnique({
    where: { id: friendId },
    include: {
      streamHistory: { orderBy: { startTime: "desc" }, take: 50 },
    },
  });

  if (!friend || !friend.streamHistory.length) return 0;

  // All other friends to cross-reference against
  const allFriends = await prisma.friend.findMany({
    where: { isActive: true, id: { not: friendId } },
    include: {
      streamHistory: { orderBy: { startTime: "desc" }, take: 50 },
    },
  });

  const signals: CollabPartner[] = [];
  const seen = new Set<string>(); // deduplicate by "login|date"

  // ── Source 1 & 2 & 3: VOD title analysis ─────────────────────────────────
  for (const vod of friend.streamHistory) {
    const title = vod.title;
    const detectedAt = vod.startTime;

    // Extract @mentions
    const atMentions = extractAtMentions(title);
    for (const handle of atMentions) {
      const key = `${handle}|${detectedAt.toDateString()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Try to match to a known friend
      const matched = allFriends.find(
        (f) => f.username.toLowerCase() === handle || f.displayName.toLowerCase() === handle
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

    // Check for known friend names in title
    for (const other of allFriends) {
      const loginMatch = nameInTitle(title, other.username);
      const displayMatch = nameInTitle(title, other.displayName);

      if (!loginMatch && !displayMatch) continue;

      const key = `${other.username}|${detectedAt.toDateString()}`;
      if (seen.has(key)) continue;

      // Skip if already caught by @mention check
      const alreadyCaught = atMentions.some(
        (h) => h === other.username.toLowerCase() || h === other.displayName.toLowerCase()
      );
      if (alreadyCaught) continue;

      seen.add(key);
      const isHighConfidence = hasCollabKeyword(title);

      signals.push({
        partnerName: other.displayName,
        partnerLogin: other.username,
        detectedAt,
        source: "vod_title_mention",
        evidence: title,
        confidence: isHighConfidence ? "high" : "medium",
      });
    }
  }

  // ── Source 4: Concurrent stream detection ─────────────────────────────────
  for (const other of allFriends) {
    for (const myStream of friend.streamHistory) {
      for (const theirStream of other.streamHistory) {
        const overlapStart = Math.max(myStream.startTime.getTime(), theirStream.startTime.getTime());
        const overlapEnd = Math.min(myStream.endTime.getTime(), theirStream.endTime.getTime());
        const overlapMs = overlapEnd - overlapStart;

        if (overlapMs < 30 * 60 * 1000) continue; // less than 30 min overlap — skip

        const key = `${other.username}|${myStream.startTime.toDateString()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        signals.push({
          partnerName: other.displayName,
          partnerLogin: other.username,
          detectedAt: myStream.startTime,
          source: "concurrent_stream",
          evidence: `Both streaming: "${myStream.title}" & "${theirStream.title}" (${Math.round(overlapMs / 60000)}m overlap)`,
          confidence: "medium",
        });
      }
    }
  }

  // ── Persist signals ───────────────────────────────────────────────────────
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
          confidence: s.confidence, // upgrade confidence if we now have a better signal
          evidence: s.evidence,
        },
      });
      stored++;
    } catch {
      // skip constraint violations (duplicate detectedAt with empty partnerLogin)
    }
  }

  return stored;
}

/**
 * Summarize collab signals for a friend into a human-readable AI prompt block.
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
  signals: { partnerName: string; partnerLogin: string; detectedAt: Date; source: string; confidence: string }[]
): CollabSummary {
  if (signals.length === 0) {
    return {
      totalSignals: 0,
      partners: [],
      summaryText: `${displayName}: no collab signals detected from VOD history.`,
    };
  }

  // Group by partner
  const byPartner = new Map<string, typeof signals>();
  for (const s of signals) {
    const key = s.partnerLogin || s.partnerName;
    if (!byPartner.has(key)) byPartner.set(key, []);
    byPartner.get(key)!.push(s);
  }

  const partners = Array.from(byPartner.entries())
    .map(([key, sigs]) => ({
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
    `${displayName} collab history (from VOD analysis): frequent partners — ${partnerList}. ` +
    `Total collab signals: ${signals.length} from ${partners.length} unique partners.`;

  return { totalSignals: signals.length, partners, summaryText };
}
