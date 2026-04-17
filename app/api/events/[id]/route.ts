import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { z } from "zod";
import {
  notifyDiscord,
  updateDiscordScheduledEvent,
  deleteDiscordScheduledEvent,
} from "@/lib/discord/notify";
import {
  normalizeParticipantsInviteStatus,
  normalizeParticipantResponseStatus,
} from "@/lib/participantStatus";

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
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const event = await prisma.event.findFirst({
      where: { id: parseInt(id), userId: user.id },
      include: {
        participants: {
          include: {
            friend: { select: { id: true, username: true, displayName: true, avatarUrl: true, isMe: true, discordUsername: true, discordId: true } },
          },
        },
        reminders: true,
      },
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    return NextResponse.json({
      ...event,
      participants: normalizeParticipantsInviteStatus(event.participants),
    });
  } catch (err) {
    console.error("[api/events/[id]] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const eventId = parseInt(id);
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.event.findFirst({ where: { id: eventId, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });

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
              friend: { select: { id: true, username: true, displayName: true, avatarUrl: true, isMe: true, discordUsername: true, discordId: true } },
            },
          },
        },
      });

      await tx.collabHistory.deleteMany({ where: { eventId } });

      if (updatedEvent.status === "completed") {
        const completedParticipants = updatedEvent.participants.filter(
          (p) => !p.friend.isMe && normalizeParticipantResponseStatus(p.inviteStatus) !== "declined",
        );
        if (completedParticipants.length > 0) {
          await tx.collabHistory.createMany({
            data: completedParticipants.map((p) => ({
              eventId,
              friendId: p.friendId,
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

    // Fire-and-forget Discord notification on meaningful status changes
    if (data.status === "confirmed") notifyDiscord(user.id, "confirmed", event);
    if (data.status === "canceled") notifyDiscord(user.id, "canceled", event);

    // Sync the change to the native Discord scheduled event if we own one.
    // Only forward the fields that actually moved, and pass start/end as a
    // pair whenever either changed (Discord requires both on EXTERNAL events).
    if (existing.discordEventId) {
      const timeChanged = data.startTime !== undefined || data.endTime !== undefined;
      updateDiscordScheduledEvent(user.id, eventId, existing.discordEventId, {
        title: data.title,
        description: data.description,
        startTime: timeChanged ? event.startTime : undefined,
        endTime: timeChanged ? event.endTime : undefined,
        status: data.status,
      });
    }

    return NextResponse.json({
      ...event,
      participants: normalizeParticipantsInviteStatus(event.participants),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    console.error("[api/events/[id]] PATCH failed:", err);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await prisma.event.findFirst({ where: { id: parseInt(id), userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await prisma.event.update({
      where: { id: parseInt(id) },
      data: { status: "canceled" },
    });

    // DELETE acts as a "cancel" on our side (soft-cancel: status flip, row
    // stays). Mirror that on Discord by PATCHing to canceled, not outright
    // deletion — keeps the scheduled event visible in the server's event
    // tab so participants see the cancellation.
    if (existing.discordEventId) {
      updateDiscordScheduledEvent(user.id, existing.id, existing.discordEventId, {
        status: "canceled",
      });
    }
    // Keep deleteDiscordScheduledEvent imported for a future hard-delete path.
    void deleteDiscordScheduledEvent;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/events/[id]] DELETE failed:", err);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
