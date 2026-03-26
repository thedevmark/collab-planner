import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { analyzePatterns, inferWindowsForRange } from "@/lib/scheduling/patterns";
import { normalizeParticipantsInviteStatus } from "@/lib/participantStatus";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const userId = user.id;

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : new Date();
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [events, scheduleSegments, friends] = await Promise.all([
      prisma.event.findMany({
        where: {
          userId,
          startTime: { gte: from },
          endTime: { lte: to },
          status: { not: "canceled" },
        },
        include: {
          participants: {
            include: {
              friend: { select: { id: true, username: true, displayName: true, avatarUrl: true, isMe: true } },
            },
          },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.scheduleSegment.findMany({
        where: {
          startTime: { gte: from },
          endTime: { lte: to },
          friend: {
            userId,
            isMe: false, // exclude the user's own schedule — shown via inferred windows
          },
        },
        include: {
          friend: { select: { id: true, username: true, displayName: true, avatarUrl: true, isMe: true } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.friend.findMany({
        where: { isActive: true, userId },
        include: {
          streamHistory: { orderBy: { startTime: "desc" }, take: 100 },
          scheduleSegments: { orderBy: { startTime: "asc" }, take: 10 },
        },
      }),
    ]);

    const inferredWindows = friends.flatMap((f) => {
      const pattern = analyzePatterns(
        f.id,
        f.displayName,
        f.streamHistory.map((h) => ({
          startTime: h.startTime,
          endTime: h.endTime,
          gameName: h.gameName,
          durationSec: h.durationSec,
        })),
        f.scheduleSegments.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          gameName: s.gameName,
          isRecurring: s.isRecurring,
        }))
      );
      return inferWindowsForRange(
        pattern.typicalDays,
        pattern.startHours.median,
        pattern.avgDurationHours,
        from,
        to
      ).map((w) => ({
        friendId: f.id,
        displayName: f.displayName,
        avatarUrl: f.avatarUrl,
        isMe: f.isMe,
        confidence: pattern.confidence,
        start: w.start.toISOString(),
        end: w.end.toISOString(),
      }));
    });

    return NextResponse.json({
      events: events.map((event) => ({
        ...event,
        participants: normalizeParticipantsInviteStatus(event.participants),
      })),
      scheduleSegments,
      inferredWindows,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch calendar data" }, { status: 500 });
  }
}
