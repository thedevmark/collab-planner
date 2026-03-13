import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzePatterns, inferWindowsForRange } from "@/lib/scheduling/patterns";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : new Date();
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [events, scheduleSegments, friends] = await Promise.all([
      prisma.event.findMany({
        where: {
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
        },
        include: {
          friend: { select: { id: true, username: true, displayName: true, avatarUrl: true, isMe: true } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.friend.findMany({
        where: { isActive: true },
        include: {
          streamHistory: { orderBy: { startTime: "desc" }, take: 30 },
          scheduleSegments: { orderBy: { startTime: "asc" }, take: 10 },
        },
      }),
    ]);

    // Build inferred stream windows for each friend based on pattern analysis
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

    return NextResponse.json({ events, scheduleSegments, inferredWindows });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch calendar data" }, { status: 500 });
  }
}
