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
  const { username } = await params;

  const friend = await prisma.friend.findFirst({
    where: { username: username.toLowerCase(), isActive: true },
    select: { id: true, displayName: true, avatarUrl: true, channelColor: true },
  });

  if (!friend) {
    return NextResponse.json({ found: false }, { headers: CORS_HEADERS });
  }

  const now = new Date();
  const [segments, participants] = await Promise.all([
    prisma.scheduleSegment.findMany({
      where: { friendId: friend.id, startTime: { gte: now, lte: addDays(now, 14) } },
      orderBy: { startTime: "asc" },
      take: 10,
      select: { title: true, startTime: true, endTime: true, isRecurring: true },
    }),
    prisma.eventParticipant.findMany({
      where: {
        friend: { username: username.toLowerCase() },
        event: { startTime: { gte: now } },
      },
      include: {
        event: { select: { title: true, startTime: true, endTime: true, gameName: true } },
      },
      orderBy: { event: { startTime: "asc" } },
      take: 3,
    }),
  ]);

  return NextResponse.json(
    {
      found: true,
      displayName: friend.displayName,
      avatarUrl: friend.avatarUrl,
      channelColor: friend.channelColor,
      schedule: segments,
      collabs: participants.map((p) => p.event),
    },
    { headers: CORS_HEADERS }
  );
}
