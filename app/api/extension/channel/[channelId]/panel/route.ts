import { NextResponse, after } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import { verifyExtensionJwt, ExtensionJwtError } from "@/lib/twitch/extensionJwt";
import { shapeConnectedPanelResponse, type PanelResponse } from "@/lib/twitch/extensionPredictions";
import { analyzePatterns, type StreamSession, type ScheduleHint } from "@/lib/scheduling/patterns";
import { getRecentBroadcasts, getBroadcasterSchedule, parseDuration, getUserById } from "@/lib/twitch/client";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const CONNECTED_TTL_SECONDS = 900; // 15 min
const UNCONNECTED_TTL_MS = 86_400_000; // 24h
const SENTINEL_TTL_MS = 60_000; // 60s — debounces concurrent cold analyses

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function readTz(req: Request): string {
  const url = new URL(req.url);
  const raw = url.searchParams.get("tz");
  if (!raw) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: raw });
    return raw;
  } catch {
    return "UTC";
  }
}

function json(body: PanelResponse | { error: string }, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init.headers ?? {}) },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return json({ error: "missing_token" }, { status: 401 });
  }

  const secret = process.env.TWITCH_EXTENSION_SECRET;
  if (!secret) {
    console.error("[ext/panel] TWITCH_EXTENSION_SECRET not set");
    return json({ error: "server_misconfigured" }, { status: 500 });
  }

  try {
    await verifyExtensionJwt(token, secret, { expectChannelId: channelId });
  } catch (err) {
    if (err instanceof ExtensionJwtError) {
      return json({ error: "invalid_token" }, { status: 401 });
    }
    throw err;
  }

  const tz = readTz(req);

  const profile = await prisma.profile.findUnique({
    where: { twitchId: channelId },
  });

  if (profile) {
    const payload = await buildConnectedPayload(profile.id, channelId, tz);
    return json(payload, {
      headers: {
        "Cache-Control": `public, s-maxage=${CONNECTED_TTL_SECONDS}, stale-while-revalidate=60`,
      },
    });
  }

  return handleUnconnected(channelId, tz);
}

async function buildConnectedPayload(userId: string, twitchId: string, timezone: string): Promise<PanelResponse> {
  const friend = await prisma.friend.findFirst({
    where: { userId, twitchId, isMe: true },
  });

  if (!friend) {
    return { status: "no_data" };
  }

  const [history, segments, eventParticipants, helixRecent] = await Promise.all([
    prisma.streamHistory.findMany({
      where: { friendId: friend.id },
      orderBy: { startTime: "desc" },
      take: 50,
    }),
    prisma.scheduleSegment.findMany({
      where: { friendId: friend.id, startTime: { gte: new Date() } },
      orderBy: { startTime: "asc" },
      take: 25,
    }),
    prisma.eventParticipant.findMany({
      where: {
        friendId: friend.id,
        event: { startTime: { gte: new Date() }, status: { in: ["planned", "confirmed"] } },
      },
      include: {
        event: {
          include: {
            participants: { include: { friend: true } },
          },
        },
      },
      orderBy: { event: { startTime: "asc" } },
      take: 5,
    }),
    // streamHistory can lag the actual broadcast cadence if the sync job is behind.
    // Pull the latest VOD from Helix in parallel so "last live" stays fresh.
    getRecentBroadcasts(twitchId, 5).catch(() => []),
  ]);

  const sessions: StreamSession[] = history.map((s) => ({
    startTime: s.startTime,
    endTime: s.endTime,
    gameName: s.gameName,
    durationSec: s.durationSec,
  }));

  const hints: ScheduleHint[] = segments.map((s) => ({
    startTime: s.startTime,
    endTime: s.endTime,
    gameName: s.gameName,
    isRecurring: s.isRecurring,
  }));

  const pattern = analyzePatterns(friend.id, friend.displayName, sessions, hints, timezone);

  const collabs = eventParticipants.map((p) => ({
    startsAt: p.event.startTime.toISOString(),
    gameName: p.event.gameName || null,
    partners: p.event.participants
      .filter((pp) => pp.friendId !== friend.id)
      .map((pp) => ({
        username: pp.friend.username,
        displayName: pp.friend.displayName,
        avatarUrl: pp.friend.avatarUrl,
      })),
  }));

  // Prefer Helix latest (fresh) over our streamHistory (may lag). If both exist,
  // pick whichever started later. Try to enrich gameName by matching the Helix
  // VOD's start time to a streamHistory row within ±2h (so we keep the rich
  // game label our sync wrote).
  const helixLatest = helixRecent[0] ?? null;
  const dbLatest = history[0] ?? null;
  type LastStream = { startedAt: Date; gameName: string | null; durationSec: number };
  let lastStream: LastStream | null = null;
  if (helixLatest) {
    const helixStart = new Date(helixLatest.created_at);
    const helixDurationSec = parseDuration(helixLatest.duration);
    const matched = history.find(
      (h) => Math.abs(h.startTime.getTime() - helixStart.getTime()) < 2 * 3600 * 1000
    );
    const candidate: LastStream = {
      startedAt: helixStart,
      gameName: matched?.gameName || null,
      durationSec: helixDurationSec || matched?.durationSec || 0,
    };
    if (!dbLatest || helixStart.getTime() >= dbLatest.startTime.getTime()) {
      lastStream = candidate;
    } else {
      lastStream = {
        startedAt: dbLatest.startTime,
        gameName: dbLatest.gameName || null,
        durationSec: dbLatest.durationSec,
      };
    }
  } else if (dbLatest) {
    lastStream = {
      startedAt: dbLatest.startTime,
      gameName: dbLatest.gameName || null,
      durationSec: dbLatest.durationSec,
    };
  }

  return shapeConnectedPanelResponse({
    pattern,
    postedSchedule: segments.map((s) => ({ start: s.startTime, end: s.endTime })),
    upcomingCollabs: collabs,
    timezone,
    lastStream,
    broadcasterAvatar: friend.avatarUrl || null,
  });
}

async function handleUnconnected(twitchId: string, timezone: string): Promise<NextResponse> {
  // For non-UTC requests, bypass the cache entirely — the cache key is only
  // twitchId, so mixing TZ results into one row would serve wrong values.
  // Non-UTC is rare on launch day; revisit if it becomes a perf issue.
  if (timezone !== "UTC") {
    return json(await computeUnconnectedNoCache(twitchId, timezone));
  }

  const now = new Date();

  const cached = await prisma.extensionPredictionCache.findUnique({
    where: { twitchId },
  });

  if (cached && cached.expiresAt > now) {
    if (cached.payload === null) {
      return json({ status: "warming" });
    }
    return json(cached.payload as PanelResponse, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=300" },
    });
  }

  // Write a sentinel and kick off the analysis without awaiting.
  await prisma.extensionPredictionCache.upsert({
    where: { twitchId },
    create: {
      twitchId,
      payload: Prisma.DbNull,
      computedAt: now,
      expiresAt: new Date(now.getTime() + SENTINEL_TTL_MS),
    },
    update: {
      payload: Prisma.DbNull,
      computedAt: now,
      expiresAt: new Date(now.getTime() + SENTINEL_TTL_MS),
    },
  });

  // Fire-and-forget. We deliberately do not await — the viewer gets "warming"
  // immediately and the next request (after ~5s retry) gets the cached payload.
  after(() => computeAndCacheUnconnected(twitchId, timezone).catch((err) => {
    console.error(`[ext/panel] background analysis failed for ${twitchId}:`, err);
  }));

  return json({ status: "warming" });
}

async function computeUnconnectedNoCache(twitchId: string, timezone: string): Promise<PanelResponse> {
  const [videos, schedule, user] = await Promise.all([
    getRecentBroadcasts(twitchId, 30),
    getBroadcasterSchedule(twitchId).catch(() => null),
    getUserById(twitchId).catch(() => null),
  ]);

  const sessions: StreamSession[] = videos.map((v) => {
    const start = new Date(v.created_at);
    const durationSec = parseDuration(v.duration);
    return {
      startTime: start,
      endTime: new Date(start.getTime() + durationSec * 1000),
      gameName: "",
      durationSec,
    };
  });

  const hints: ScheduleHint[] = (schedule?.segments ?? []).map((seg) => ({
    startTime: new Date(seg.start_time),
    endTime: new Date(seg.end_time),
    gameName: seg.category?.name ?? "",
    isRecurring: seg.is_recurring ?? false,
  }));

  const pattern = analyzePatterns(0, twitchId, sessions, hints, timezone);

  const lastSession = sessions[0] ?? null;

  return shapeConnectedPanelResponse({
    pattern,
    postedSchedule: hints.map((h) => ({ start: h.startTime, end: h.endTime })),
    upcomingCollabs: [],
    timezone,
    lastStream: lastSession
      ? { startedAt: lastSession.startTime, gameName: lastSession.gameName || null, durationSec: lastSession.durationSec }
      : null,
    broadcasterAvatar: user?.profile_image_url || null,
  });
}

async function computeAndCacheUnconnected(twitchId: string, timezone: string): Promise<void> {
  const payload = await computeUnconnectedNoCache(twitchId, timezone);

  const now = new Date();
  await prisma.extensionPredictionCache.upsert({
    where: { twitchId },
    create: {
      twitchId,
      payload: payload as unknown as Prisma.InputJsonValue,
      computedAt: now,
      expiresAt: new Date(now.getTime() + UNCONNECTED_TTL_MS),
    },
    update: {
      payload: payload as unknown as Prisma.InputJsonValue,
      computedAt: now,
      expiresAt: new Date(now.getTime() + UNCONNECTED_TTL_MS),
    },
  });
}
