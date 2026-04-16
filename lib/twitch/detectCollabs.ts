import { prisma } from "@/lib/db";

export type CollabSource =
  | "confirmed_event"   // ground truth — completed event with both participants
  | "guest_star"        // Helix Guest Star session history (own channel only)
  | "vod_title_mention"; // @handle or name+keyword in a VOD title

export interface CollabPartner {
  partnerName: string;
  partnerLogin: string;
  detectedAt: Date;
  source: CollabSource;
  evidence: string;
  confidence: "high" | "medium" | "weak";
}

/**
 * Keywords that strongly suggest a collaboration VOD when combined with a name mention.
 *
 * Kept deliberately narrow: generic words like "with", "w/", "duo", "trio", "squad",
 * "guest", "join", "together", and "hosted" produced massive false-positive rates
 * because they appear in unrelated titles ("streaming with no mic", "squad grind",
 * "guest character gameplay", "join the discord") and in standard BR/FPS game-mode
 * names. The remaining keywords are unambiguous collab signals.
 */
const COLLAB_KEYWORDS = [
  "collab", "collaboration", "ft.", "feat.", "featuring",
  "co-stream", "co stream", "costream", "stream together",
];

/** Minimum length of a friend's name to be matched by substring in a VOD title. */
const MIN_NAME_MATCH_LEN = 4;

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

/**
 * Escape a string for safe use inside a RegExp.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Does `title` contain `name` as a whole word (word-boundary match), case-insensitive?
 *
 * We use `\b` on both sides so "ninja" does NOT match "ninjago" and "boyz" does NOT
 * match "cowboyz". Names shorter than MIN_NAME_MATCH_LEN are rejected outright — they
 * produce too many coincidental matches even with word boundaries.
 */
function containsNameAsWord(title: string, name: string): boolean {
  if (!name || name.length < MIN_NAME_MATCH_LEN) return false;
  const re = new RegExp(`\\b${escapeRegex(name)}\\b`, "i");
  return re.test(title);
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
 *   2. Another friend's name/login appearing as a whole word in a VOD title
 *      plus a collab keyword → high confidence
 *
 * Bare name-in-title matches WITHOUT a collab keyword are not persisted as signals.
 * Stream overlap (both streamers live at the same time) is NOT a signal — two people
 * being live simultaneously doesn't mean they collaborated, and at peak hours this
 * produced an overwhelming flood of false positives.
 *
 * All non-ground-truth signals are cleared before re-detection so stale entries from
 * earlier (looser) detection rules don't linger.
 *
 * Self-references are filtered out at every source so a streamer's own VODs don't
 * produce a signal of themselves as a collab partner.
 */
export async function detectCollabSignals(friendId: number): Promise<number> {
  const friend = await prisma.friend.findUnique({
    where: { id: friendId },
    include: {
      streamHistory: { orderBy: { startTime: "desc" }, take: 50 },
    },
  });

  if (!friend) return 0;

  // Wipe derived signals from earlier runs so renamed/removed friends and
  // signals that no longer meet the current rules disappear on refresh.
  // confirmed_event is ground truth from the events table — keep those.
  await prisma.collabSignal.deleteMany({
    where: {
      friendId,
      source: { not: "confirmed_event" },
    },
  });

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
      // Word-boundary match on both login and displayName. Names shorter than
      // MIN_NAME_MATCH_LEN are rejected — even with \b they false-match too often
      // (e.g. "Gbo" appearing as a user handle would match any 3-letter run).
      const matches =
        containsNameAsWord(title, other.username) ||
        containsNameAsWord(title, other.displayName);
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

  // ── Source 3: Confirmed events (ground truth) ────────────────────────────
  // When the user completes an event with participants, CollabHistory rows
  // are created. We join those through to the event's participant list to
  // find every OTHER friend who was in the same event — that's a confirmed
  // collab between the subject friend and each co-participant.
  const confirmedHistories = await prisma.collabHistory.findMany({
    where: { friendId, eventId: { not: null } },
    include: {
      event: {
        include: {
          participants: {
            include: {
              friend: {
                select: { id: true, username: true, displayName: true, isMe: true },
              },
            },
          },
        },
      },
    },
  });

  for (const ch of confirmedHistories) {
    if (!ch.event) continue;
    for (const p of ch.event.participants) {
      // Skip self, skip the subject friend, skip the user's "me" friend
      if (p.friend.isMe) continue;
      if (p.friendId === friendId) continue;
      if (isSelfReference(p.friend.username, subject)) continue;

      const key = `confirmed|${p.friend.username.toLowerCase()}|${ch.date.toDateString()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      signals.push({
        partnerName: p.friend.displayName,
        partnerLogin: p.friend.username,
        detectedAt: ch.date,
        source: "confirmed_event",
        evidence: `Confirmed event: ${ch.title}`,
        confidence: "high",
      });
    }
  }

  // ── Source 4 (stub): Helix Guest Star ───────────────────────────────────
  // The Twitch Guest Star API (channel:read:guest_star) only works for
  // channels the authenticated user owns or moderates. When that scope is
  // available, call GET /helix/guest_star/session here and create signals
  // with source: "guest_star", confidence: "high".
  //
  // Not yet wired — requires adding the scope to the Twitch OAuth flow and
  // storing a broadcaster-level access token per user. The infrastructure
  // accepts "guest_star" as a valid source string, so plugging it in later
  // is a single function addition with no schema or display changes.

  // NOTE: we deliberately do NOT use concurrent-stream overlap as a signal.
  // Two streamers being live at the same time — even on the same game — is
  // circumstantial at best; at peak hours it produced a flood of false
  // positives (any popular streamer the user also watches would be flagged).
  // A real collab is signaled by VOD titles, @mentions, or a completed event.

  // ── Persist signals ──────────────────────────────────────────────────────
  // Confidence ranking used to decide whether an update should overwrite an
  // existing signal. Higher-tier sources never get downgraded by re-runs of
  // lower-tier detection.
  const CONFIDENCE_RANK: Record<string, number> = {
    high: 3,
    medium: 2,
    weak: 1,
  };

  let stored = 0;
  for (const s of signals) {
    try {
      const existing = await prisma.collabSignal.findUnique({
        where: {
          friendId_partnerLogin_detectedAt: {
            friendId,
            partnerLogin: s.partnerLogin,
            detectedAt: s.detectedAt,
          },
        },
        select: { confidence: true },
      });

      // Only overwrite if the new signal is at least as confident
      if (existing && (CONFIDENCE_RANK[existing.confidence] ?? 0) > (CONFIDENCE_RANK[s.confidence] ?? 0)) {
        continue;
      }

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
