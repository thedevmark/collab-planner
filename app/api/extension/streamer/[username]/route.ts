import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addDays } from "date-fns";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const normalizedUsername = username.toLowerCase();

    const profile = await prisma.profile.findFirst({
      where: {
        username: normalizedUsername,
      },
      select: {
        twitchId: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        channelColor: true,
      },
    });

    const friend = profile
      ? await prisma.friend.findFirst({
          where: {
            twitchId: profile.twitchId,
            isMe: true,
            isActive: true,
          },
          select: { id: true, displayName: true, avatarUrl: true, channelColor: true },
        })
      : await prisma.friend.findFirst({
          where: {
            username: normalizedUsername,
            isActive: true,
          },
          select: { id: true, displayName: true, avatarUrl: true, channelColor: true },
        });

    if (!profile && !friend) {
      return NextResponse.json({ found: false }, { headers: CORS_HEADERS });
    }

    const now = new Date();
    const [segments, participants] = friend
      ? await Promise.all([
          prisma.scheduleSegment.findMany({
            where: { friendId: friend.id, startTime: { gte: now, lte: addDays(now, 14) } },
            orderBy: { startTime: "asc" },
            take: 10,
            select: { title: true, startTime: true, endTime: true, isRecurring: true },
          }),
          prisma.eventParticipant.findMany({
            where: {
              friendId: friend.id,
              event: { startTime: { gte: now } },
            },
            include: {
              event: { select: { title: true, startTime: true, endTime: true, gameName: true } },
            },
            orderBy: { event: { startTime: "asc" } },
            take: 3,
          }),
        ])
      : [[], []];

    return NextResponse.json(
      {
        found: true,
        displayName: profile?.displayName ?? friend?.displayName ?? normalizedUsername,
        avatarUrl: profile?.avatarUrl ?? friend?.avatarUrl ?? "",
        channelColor: friend?.channelColor || profile?.channelColor || "",
        schedule: segments,
        collabs: participants.map((p) => p.event),
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("[extension/streamer] failed", error);
    return NextResponse.json(
      { found: false, error: "Failed to load streamer" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
