import { prisma } from "@/lib/db";
import { publicApiJson, publicApiPreflight } from "@/lib/publicApiCors";

export async function OPTIONS(req: Request) {
  return publicApiPreflight(req);
}

/**
 * Upcoming stream schedule for a user. Merges posted Twitch schedule segments
 * with the user's planned collab events, ordered by start time.
 *
 * Query:
 *   user=<twitchLogin>   required
 *   days=<1-30>          default 7
 *   limit=<1-25>         default 3
 *
 * Returns:
 *   200 { login, displayName, timezone, profileImageUrl, upcoming: [...], lastUpdatedIso }
 *   404 { error: "not_found" } — user missing OR not opted in (single status to
 *       avoid fingerprinting which logins exist but have the flag off).
 *   400 { error: "missing_user" }
 *
 * Contract negotiated with toolset/VSO — see `/api/public/schedule` request
 * in collab-planner inbox 2026-05-23.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = url.searchParams.get("user")?.trim().toLowerCase();
  const daysRaw = Number.parseInt(url.searchParams.get("days") ?? "7", 10);
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "3", 10);

  const days = Number.isFinite(daysRaw) ? Math.min(30, Math.max(1, daysRaw)) : 7;
  const limit = Number.isFinite(limitRaw) ? Math.min(25, Math.max(1, limitRaw)) : 3;

  if (!user) {
    return publicApiJson(req, { error: "missing_user" }, 400);
  }

  try {
    const profile = await prisma.profile.findFirst({
      where: { username: { equals: user, mode: "insensitive" } },
    });

    // Single 404 covers both "no such user" and "exists but not opted in" so
    // a probe can't fingerprint who has the toggle off.
    if (!profile || !profile.publicApiEnabled) {
      return publicApiJson(req, { error: "not_found" }, 404);
    }

    const now = new Date();
    const windowEnd = new Date(now.getTime() + days * 86_400_000);

    // The user's posted Twitch schedule lives on their Friend record with
    // isMe=true. Skip if missing — they just won't have Twitch-side segments.
    const me = await prisma.friend.findFirst({
      where: { userId: profile.id, isMe: true, isActive: true },
      select: { id: true },
    });

    const [segments, events] = await Promise.all([
      me
        ? prisma.scheduleSegment.findMany({
            where: {
              friendId: me.id,
              startTime: { gte: now, lte: windowEnd },
            },
            orderBy: { startTime: "asc" },
            take: limit * 2, // overfetch — merged with events then re-trimmed
          })
        : Promise.resolve([] as Array<never>),
      prisma.event.findMany({
        where: {
          userId: profile.id,
          status: { in: ["planned", "confirmed"] },
          startTime: { gte: now, lte: windowEnd },
        },
        orderBy: { startTime: "asc" },
        take: limit * 2,
      }),
    ]);

    type UpcomingEntry = {
      startsAtIso: string;
      endsAtIso: string;
      title: string;
      category: string;
      source: "twitch_schedule" | "collab_planner_event";
      isRecurring: boolean;
      platform: "twitch";
    };

    const upcoming: UpcomingEntry[] = [
      ...segments.map((s) => ({
        startsAtIso: s.startTime.toISOString(),
        endsAtIso: s.endTime.toISOString(),
        title: s.title,
        category: s.gameName,
        source: "twitch_schedule" as const,
        isRecurring: s.isRecurring,
        platform: "twitch" as const,
      })),
      ...events.map((e) => ({
        startsAtIso: e.startTime.toISOString(),
        endsAtIso: e.endTime.toISOString(),
        title: e.title,
        category: e.gameName,
        source: "collab_planner_event" as const,
        isRecurring: false,
        platform: "twitch" as const,
      })),
    ]
      .sort((a, b) => a.startsAtIso.localeCompare(b.startsAtIso))
      .slice(0, limit);

    // lastUpdatedIso reflects the most recent Twitch schedule sync. Events are
    // user-created so don't count toward "freshness from the source".
    const lastFetched = segments.reduce<Date | null>((acc, s) => {
      if (!acc || s.fetchedAt > acc) return s.fetchedAt;
      return acc;
    }, null);

    return publicApiJson(
      req,
      {
        login: profile.username,
        displayName: profile.displayName,
        timezone: profile.timezone,
        profileImageUrl: profile.avatarUrl || null,
        upcoming,
        lastUpdatedIso: lastFetched ? lastFetched.toISOString() : null,
      },
      200,
      { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    );
  } catch (err) {
    console.error("[api/public/schedule] GET failed:", err);
    return publicApiJson(req, { error: "internal_error" }, 500);
  }
}
