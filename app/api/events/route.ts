import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { z } from "zod";
import { notifyDiscord } from "@/lib/discord/notify";
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
    if (end <= start) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    if (data.fromInviteToken) {
      const invite = await prisma.collabInvite.findUnique({
        where: { token: data.fromInviteToken },
      });

      if (!invite) {
        return NextResponse.json({ error: "Invite not found" }, { status: 404 });
      }

      const now = new Date();
      const expired = invite.expiresAt != null && invite.expiresAt < now;
      const exhausted = invite.maxUses != null && invite.usedCount >= invite.maxUses;

      if (expired) {
        return NextResponse.json({ error: "Invite has expired" }, { status: 400 });
      }

      if (exhausted) {
        return NextResponse.json({ error: "Invite has reached its usage limit" }, { status: 400 });
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
      const createdEvent = await tx.event.create({
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
              friend: { select: { id: true, username: true, displayName: true, avatarUrl: true, isMe: true, discordUsername: true, discordId: true } },
            },
          },
        },
      });

      if (data.fromInviteToken) {
        const invite = await tx.collabInvite.findUnique({
          where: { token: data.fromInviteToken },
        });

        if (!invite) {
          throw new Error("Invite not found");
        }

        const inviteExpired = invite.expiresAt != null && invite.expiresAt < new Date();
        const inviteExhausted = invite.maxUses != null && invite.usedCount >= invite.maxUses;

        if (inviteExpired) {
          throw new Error("Invite has expired");
        }

        if (inviteExhausted) {
          throw new Error("Invite has reached its usage limit");
        }

        await tx.collabInvite.update({
          where: { token: data.fromInviteToken },
          data: { usedCount: { increment: 1 } },
        });
      }

      return createdEvent;
    });

    // Fire-and-forget Discord notification
    notifyDiscord(userId, "created", event);

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
    if (err instanceof Error && (err.message === "Invite not found" || err.message === "Invite has expired" || err.message === "Invite has reached its usage limit")) {
      return NextResponse.json({ error: err.message }, { status: err.message === "Invite not found" ? 404 : 400 });
    }
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
