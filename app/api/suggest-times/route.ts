import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { getPlannerTopSlots } from "@/lib/scheduling/planner";

/**
 * POST /api/suggest-times
 * Body: { friendIds: number[] }
 *
 * Returns top collab windows scored by streaming pattern overlap probability.
 * All times are returned in UTC; display strings are formatted in the user's
 * saved timezone (Profile.timezone). No AI involved.
 */
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { friendIds } = await req.json() as { friendIds: number[] };

    if (!Array.isArray(friendIds) || friendIds.length === 0) {
      return NextResponse.json({ error: "friendIds required" }, { status: 400 });
    }

    // Get user's timezone preference
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { timezone: true },
    });
    const timezone = profile?.timezone ?? "UTC";

    // Verify ownership and fetch friends with their stream data
    const friends = await prisma.friend.findMany({
      where: { id: { in: friendIds }, userId: user.id },
      include: {
        streamHistory: {
          orderBy: { startTime: "desc" },
          take: 100,
          select: { startTime: true, endTime: true, gameName: true, durationSec: true },
        },
        scheduleSegments: {
          where: {
            startTime: { gte: new Date() },
          },
          select: { startTime: true, endTime: true, title: true, isRecurring: true },
        },
      },
    });

    if (friends.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const now = new Date();
    const slots = getPlannerTopSlots(friends, now, new Date(now.getTime() + 14 * 86400000), 5);

    // Format display strings in the user's timezone
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const suggestions = slots.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      combinedScore: Math.round(slot.combinedScore * 100),
      confidence: slot.confidence,
      displayStart: dtf.format(slot.start),
      displayEnd: dtf.format(slot.end),
      timezone,
      windowHours: Math.round(((slot.end.getTime() - slot.start.getTime()) / 3600000) * 10) / 10,
      friendScores: slot.friendScores.map((fs) => ({
        friendId: fs.friendId,
        displayName: fs.displayName,
        probability: Math.round(fs.score * 100),
      })),
    }));

    return NextResponse.json({ suggestions, timezone });
  } catch (err) {
    console.error("suggest-times error:", err);
    return NextResponse.json({ error: "Failed to compute suggestions" }, { status: 500 });
  }
}
