import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import {
  analyzePatterns,
  type StreamSession,
  type ScheduleHint,
} from "@/lib/scheduling/patterns";
import { shapeConnectedPanelResponse } from "@/lib/twitch/extensionPredictions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const friendId = Number.parseInt(id, 10);
  if (!Number.isFinite(friendId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const friend = await prisma.friend.findFirst({
    where: { id: friendId, userId: user.id },
  });
  if (!friend) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { timezone: true },
  });
  const timezone = profile?.timezone || "UTC";

  const [history, segments] = await Promise.all([
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

  const response = shapeConnectedPanelResponse({
    pattern,
    postedSchedule: segments.map((s) => ({ start: s.startTime, end: s.endTime })),
    timezone,
    lastStream: null,
  });

  return NextResponse.json(response, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
