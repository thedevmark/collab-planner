import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { z } from "zod";
import { notifyDiscord, createDiscordScheduledEvent } from "@/lib/discord/notify";
import { normalizeParticipantsInviteStatus } from "@/lib/participantStatus";

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  gameName: z.string().optional(),
  gameId: z.string().optional(),
  participantIds: z.array(z.number()).optional(),
  fromInviteToken: z.string().optional(),
});

async function consumeInviteOrThrow(
  tx: Prisma.TransactionClient,
  token: string,
) {
  const now = new Date();
  const updatedRows = await tx.$queryRaw<Array<{ id: number }>>`
    UPDATE "CollabInvite"
    SET "usedCount" = "usedCount" + 1
    WHERE "token" = ${token}
      AND ("expiresAt" IS NULL OR "expiresAt" >= ${now})
      AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
    RETURNING "id"
  `;

  if (updatedRows.length > 0) {
    return;
  }

  const invite = await tx.collabInvite.findUnique({
    where: { token },
    select: { expiresAt: true, maxUses: true, usedCount: true },
  });

  if (!invite) {
    throw new Error("Invite not found");
  }

  if (invite.expiresAt != null && invite.expiresAt < now) {
    throw new Error("Invite has expired");
  }

  if (invite.maxUses != null && invite.usedCount >= invite.maxUses) {
    throw new Error("Invite has reached its usage limit");
  }

  throw new Error("Failed to consume invite");
}

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
            friend: { select: { id: true, username: true, displayName: true, avatarUrl: true, isMe: true, discordUsername: true, discordId: true } },
          },
        },
      },
      orderBy: { startTime: "asc" },
    });
    return NextResponse.json(
      events.map((event) => ({
        ...event,
        participants: normalizeParticipantsInviteStatus(event.participants),
      })),
    );
  } catch (err) {
    console.error("[api/events] GET failed:", err);
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
    const participantIds = data.participantIds
      ? [...new Set(data.participantIds)]
      : [];

    if (end <= start) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    if (participantIds.length > 0) {
      const ownedParticipants = await prisma.friend.findMany({
        where: { id: { in: participantIds }, userId },
        select: { id: true },
      });

      if (ownedParticipants.length !== participantIds.length) {
        return NextResponse.json({ error: "Participant not found" }, { status: 404 });
      }
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

    const event = await prisma.$transaction(async (tx) => {
      if (data.fromInviteToken) {
        await consumeInviteOrThrow(tx, data.fromInviteToken);
      }

      const createdEvent = await tx.event.create({
        data: {
          userId,
          title: data.title,
          description: data.description ?? "",
          startTime: start,
          endTime: end,
          gameName: data.gameName ?? "",
          gameId: data.gameId ?? "",
          participants: participantIds.length > 0
            ? { create: participantIds.map((friendId) => ({ friendId })) }
            : undefined,
          reminders: reminders.length > 0 ? { create: reminders } : undefined,
        },
        include: {
          participants: {
            include: {
              friend: { select: { id: true, username: true, displayName: true, avatarUrl: true, isMe: true, discordUsername: true, discordId: true } },
            },
          },
        },
      });

      return createdEvent;
    });

    // Fire-and-forget Discord notifications
    notifyDiscord(userId, "created", event);
    createDiscordScheduledEvent(userId, event.id, {
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
    });

    return NextResponse.json(
      {
        ...event,
        participants: normalizeParticipantsInviteStatus(event.participants),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.message }, { status: 400 });
    }
    if (
      err instanceof Error
      && (
        err.message === "Invite not found"
        || err.message === "Invite has expired"
        || err.message === "Invite has reached its usage limit"
      )
    ) {
      return NextResponse.json({ error: err.message }, { status: err.message === "Invite not found" ? 404 : 400 });
    }
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
