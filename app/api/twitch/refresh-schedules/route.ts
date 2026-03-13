import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBroadcasterSchedule, getChatColor } from "@/lib/twitch/client";
import { fetchAndStoreStreamHistory } from "@/lib/twitch/fetchStreamHistory";

export async function POST() {
  try {
    const friends = await prisma.friend.findMany({ where: { isActive: true } });
    const results: { friendId: number; username: string; historyCount: number; scheduleCount: number; error?: string }[] = [];

    for (const friend of friends) {
      try {
        const [historyCount, scheduleResult] = await Promise.allSettled([
          fetchAndStoreStreamHistory(friend.id, friend.twitchId, 20),
          getBroadcasterSchedule(friend.twitchId).then(async (schedule) => {
            await prisma.scheduleSegment.deleteMany({ where: { friendId: friend.id } });
            if (!schedule?.segments) return 0;
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
            return created.count;
          }),
        ]);

        // Backfill channel color if not yet stored
        if (!friend.channelColor) {
          const color = await getChatColor(friend.twitchId);
          if (color) {
            await prisma.friend.update({ where: { id: friend.id }, data: { channelColor: color } });
          }
        }

        results.push({
          friendId: friend.id,
          username: friend.username,
          historyCount: historyCount.status === "fulfilled" ? historyCount.value : 0,
          scheduleCount: scheduleResult.status === "fulfilled" ? scheduleResult.value : 0,
        });
      } catch (err) {
        results.push({
          friendId: friend.id,
          username: friend.username,
          historyCount: 0,
          scheduleCount: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: "Failed to refresh" }, { status: 500 });
  }
}
