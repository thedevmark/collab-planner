import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBroadcasterSchedule } from "@/lib/twitch/client";

const STALE_HOURS = 6;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const segments = await prisma.scheduleSegment.findMany({
      where: { friendId: parseInt(id), endTime: { gte: new Date() } },
      orderBy: { startTime: "asc" },
    });
    return NextResponse.json(segments);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const friend = await prisma.friend.findUnique({ where: { id: parseInt(id) } });
    if (!friend) return NextResponse.json({ error: "Friend not found" }, { status: 404 });

    // Check if recently fetched
    const latest = await prisma.scheduleSegment.findFirst({
      where: { friendId: friend.id },
      orderBy: { fetchedAt: "desc" },
    });

    const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);
    if (latest && latest.fetchedAt > staleThreshold) {
      return NextResponse.json({ message: "Schedule is up to date", segments: [] });
    }

    const schedule = await getBroadcasterSchedule(friend.twitchId);

    // Delete old segments and insert fresh ones
    await prisma.scheduleSegment.deleteMany({ where: { friendId: friend.id } });

    if (schedule?.segments) {
      const created = await prisma.scheduleSegment.createMany({
        data: schedule.segments
          .filter((s) => !s.canceled_until)
          .map((s) => ({
            friendId: friend.id,
            segmentId: s.id,
            title: s.title,
            startTime: new Date(s.start_time),
            endTime: new Date(s.end_time),
            gameName: s.category?.name ?? "",
            gameId: s.category?.id ?? "",
            isRecurring: s.is_recurring,
          })),
      });
      return NextResponse.json({ message: "Schedule refreshed", count: created.count });
    }

    return NextResponse.json({ message: "No schedule available", count: 0 });
  } catch (err) {
    return NextResponse.json({ error: `Failed to refresh schedule: ${err instanceof Error ? err.message : "Unknown error"}` }, { status: 500 });
  }
}
