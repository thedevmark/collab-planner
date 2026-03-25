import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { getBroadcasterSchedule } from "@/lib/twitch/client";

const STALE_HOURS = 6;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const friend = await prisma.friend.findFirst({ where: { id: parseInt(id), userId: user.id } });
    if (!friend) return NextResponse.json({ error: "Friend not found" }, { status: 404 });

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
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const friend = await prisma.friend.findFirst({ where: { id: parseInt(id), userId: user.id } });
    if (!friend) return NextResponse.json({ error: "Friend not found" }, { status: 404 });

    const latest = await prisma.scheduleSegment.findFirst({
      where: { friendId: friend.id },
      orderBy: { fetchedAt: "desc" },
    });

    const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);
    if (latest && latest.fetchedAt > staleThreshold) {
      return NextResponse.json({ message: "Schedule is up to date", segments: [] });
    }

    const schedule = await getBroadcasterSchedule(friend.twitchId);

    await prisma.scheduleSegment.deleteMany({ where: { friendId: friend.id } });

    if (schedule?.segments) {
      const created = await prisma.scheduleSegment.createMany({
        data: schedule.segments
          .filter((s) => !s.canceled_until)
          .map((s) => {
            const startTime = new Date(s.start_time);
            const endTime = s.end_time ? new Date(s.end_time) : new Date(startTime.getTime() + 3 * 3600 * 1000);
            return {
              friendId: friend.id,
              segmentId: s.id,
              title: s.title,
              startTime,
              endTime,
              gameName: s.category?.name ?? "",
              gameId: s.category?.id ?? "",
              isRecurring: s.is_recurring,
            };
          }),
      });
      return NextResponse.json({ message: "Schedule refreshed", count: created.count });
    }

    return NextResponse.json({ message: "No schedule available", count: 0 });
  } catch (err) {
    return NextResponse.json({ error: `Failed to refresh schedule: ${err instanceof Error ? err.message : "Unknown error"}` }, { status: 500 });
  }
}
