import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { z } from "zod";

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  gameName: z.string().optional(),
  gameId: z.string().optional(),
  participantIds: z.array(z.number()).optional(),
});

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const userId = user.id;

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const events = await prisma.event.findMany({
      where: {
        userId,
        ...(from && { startTime: { gte: new Date(from) } }),
        ...(to && { endTime: { lte: new Date(to) } }),
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
    });
    return NextResponse.json(events);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const userId = user.id;

  try {
    const body = await req.json();
    const data = createEventSchema.parse(body);

    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    if (end <= start) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    const now = new Date();
    const autoReminders = [
      { offset: 14 * 24 * 60 * 60 * 1000, label: "2 weeks before" },
      { offset:  7 * 24 * 60 * 60 * 1000, label: "1 week before" },
      { offset:      24 * 60 * 60 * 1000, label: "1 day before" },
      { offset:       2 * 60 * 60 * 1000, label: "2 hours before" },
    ];
    const reminders = autoReminders
      .map(({ offset, label }) => ({ remindAt: new Date(start.getTime() - offset), label }))
      .filter(({ remindAt }) => remindAt > now);

    const event = await prisma.event.create({
      data: {
        userId,
        title: data.title,
        description: data.description ?? "",
        startTime: start,
        endTime: end,
        gameName: data.gameName ?? "",
        gameId: data.gameId ?? "",
        participants: data.participantIds
          ? { create: data.participantIds.map((friendId) => ({ friendId })) }
          : undefined,
        reminders: reminders.length > 0 ? { create: reminders } : undefined,
      },
      include: {
        participants: {
          include: {
            friend: { select: { id: true, username: true, displayName: true, avatarUrl: true, isMe: true } },
          },
        },
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
