import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const events = await prisma.event.findMany({
      where: {
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
  try {
    const body = await req.json();
    const data = createEventSchema.parse(body);

    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    if (end <= start) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    const event = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description ?? "",
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        gameName: data.gameName ?? "",
        gameId: data.gameId ?? "",
        participants: data.participantIds
          ? {
              create: data.participantIds.map((friendId) => ({ friendId })),
            }
          : undefined,
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
