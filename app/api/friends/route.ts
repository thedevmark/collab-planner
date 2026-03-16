import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserByUsername, getBroadcasterSchedule, getChatColor } from "@/lib/twitch/client";
import { backfillStoredStreamHistoryGameNames, fetchAndStoreStreamHistory } from "@/lib/twitch/fetchStreamHistory";
import { z } from "zod";

/** Fire-and-forget: backfill channelColor for any friend missing it */
async function backfillMissingColors(friends: { id: number; username: string; channelColor: string }[]) {
  const missing = friends.filter((f) => !f.channelColor);
  if (missing.length === 0) return;
  for (const f of missing) {
    try {
      const color = await getChatColor(f.username);
      if (color) await prisma.friend.update({ where: { id: f.id }, data: { channelColor: color } });
    } catch { /* ignore */ }
  }
}

const addFriendSchema = z.object({
  username: z.string().min(1),
});

export async function GET() {
  try {
    await backfillStoredStreamHistoryGameNames().catch(() => {});
    const now = new Date();

    const friends = await prisma.friend.findMany({
      where: { isActive: true },
      include: {
        scheduleSegments: {
          where: { endTime: { gte: new Date() } },
          orderBy: { startTime: "asc" },
          take: 5,
        },
        streamHistory: {
          orderBy: { startTime: "desc" },
          take: 20,
        },
        collabSignals: {
          orderBy: [{ confidence: "desc" }, { detectedAt: "desc" }],
          take: 20,
        },
      },
      orderBy: { displayName: "asc" },
    });

    const pastParticipants = await prisma.eventParticipant.findMany({
      where: {
        friendId: { in: friends.map((friend) => friend.id) },
        event: {
          startTime: { lte: now },
          status: "completed",
        },
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            gameName: true,
            startTime: true,
            status: true,
          },
        },
      },
      orderBy: [
        { event: { startTime: "desc" } },
        { id: "desc" },
      ],
    });

    const recentCollabsByFriend = new Map<number, Array<{
      eventId: number;
      title: string;
      description: string;
      gameName: string;
      startTime: Date;
      status: string;
    }>>();

    for (const participant of pastParticipants) {
      const event = participant.event;
      if (!event) continue;

      const existing = recentCollabsByFriend.get(participant.friendId) ?? [];
      if (existing.some((entry) => entry.eventId === event.id)) continue;

      existing.push({
        eventId: event.id,
        title: event.title,
        description: event.description,
        gameName: event.gameName,
        startTime: event.startTime,
        status: event.status,
      });
      recentCollabsByFriend.set(participant.friendId, existing);
    }

    // Background: fill in any missing channel colors (new field, existing rows may be empty)
    backfillMissingColors(friends).catch(() => {});

    return NextResponse.json(
      friends.map((friend) => ({
        ...friend,
        recentCollabs: (recentCollabsByFriend.get(friend.id) ?? []).slice(0, 3),
      }))
    );
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch friends" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username } = addFriendSchema.parse(body);

    const twitchUser = await getUserByUsername(username);
    if (!twitchUser) {
      return NextResponse.json({ error: "Twitch user not found" }, { status: 404 });
    }

    const existing = await prisma.friend.findUnique({ where: { twitchId: twitchUser.id } });
    if (existing) {
      if (!existing.isActive) {
        const updated = await prisma.friend.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
        return NextResponse.json(updated);
      }
      return NextResponse.json({ error: "Friend already added" }, { status: 409 });
    }

    // Fetch channel brand color from Twitch GQL
    const channelColor = await getChatColor(twitchUser.login);

    const friend = await prisma.friend.create({
      data: {
        twitchId: twitchUser.id,
        username: twitchUser.login,
        displayName: twitchUser.display_name,
        avatarUrl: twitchUser.profile_image_url,
        channelColor,
      },
    });

    // Fetch stream history (primary data source) + schedule (bonus if available)
    await Promise.allSettled([
      fetchAndStoreStreamHistory(friend.id, twitchUser.id, 20),
      getBroadcasterSchedule(twitchUser.id).then(async (schedule) => {
        if (schedule?.segments) {
          await prisma.scheduleSegment.createMany({
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
        }
      }),
    ]);

    return NextResponse.json(friend, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "";
    // Surface Twitch API errors cleanly; hide internal DB/Prisma details
    if (msg.includes("Twitch API error") || msg.includes("not configured")) {
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to add friend. Please try again." }, { status: 500 });
  }
}
