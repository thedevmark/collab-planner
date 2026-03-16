import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  gameName: z.string().optional(),
  gameId: z.string().optional(),
  status: z.enum(["planned", "confirmed", "completed", "canceled"]).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const event = await prisma.event.findUnique({
      where: { id: parseInt(id) },
      include: {
        participants: {
          include: {
            friend: { select: { id: true, username: true, displayName: true, avatarUrl: true, isMe: true } },
          },
        },
        reminders: true,
        messageLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    return NextResponse.json(event);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const eventId = parseInt(id);
    const body = await req.json();
    const data = updateSchema.parse(body);

    const event = await prisma.$transaction(async (tx) => {
      const updatedEvent = await tx.event.update({
        where: { id: eventId },
        data: {
          ...data,
          ...(data.startTime && { startTime: new Date(data.startTime) }),
          ...(data.endTime && { endTime: new Date(data.endTime) }),
        },
        include: {
          participants: {
            include: {
              friend: { select: { id: true, username: true, displayName: true, avatarUrl: true, isMe: true } },
            },
          },
        },
      });

      await tx.collabHistory.deleteMany({
        where: { eventId },
      });

      if (updatedEvent.status === "completed") {
        const completedParticipants = updatedEvent.participants.filter((participant) => !participant.friend.isMe);

        if (completedParticipants.length > 0) {
          await tx.collabHistory.createMany({
            data: completedParticipants.map((participant) => ({
              eventId,
              friendId: participant.friendId,
              title: updatedEvent.title,
              gameName: updatedEvent.gameName,
              date: updatedEvent.startTime,
              notes: updatedEvent.description,
            })),
          });
        }
      }

      return updatedEvent;
    });

    return NextResponse.json(event);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.event.update({
      where: { id: parseInt(id) },
      data: { status: "canceled" },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
