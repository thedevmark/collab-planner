import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { buildInviteMessage, buildReminderMessage } from "@/lib/discord/templates";

const generateMessageSchema = z.object({
  messageType: z.enum(["invite", "reminder"]),
  eventId: z.number().int().positive().optional(),
  friendIds: z.array(z.number().int().positive()).optional(),
  additionalContext: z.string().trim().max(500).optional(),
});

function uniqueMentions(friends: Array<{ displayName: string; username: string }>): string[] {
  return [...new Set(
    friends.map((friend) => friend.username ? `@${friend.username}` : friend.displayName)
  )];
}

function buildGenericInviteMessage(friends: string[], additionalContext?: string): string {
  const greeting = friends.length > 0 ? `${friends.join(", ")} -` : "Hey -";
  const lines = [
    greeting,
    "",
    "Want to plan a collab stream soon?",
  ];

  if (additionalContext?.trim()) {
    lines.push("");
    lines.push(additionalContext.trim());
  }

  lines.push("");
  lines.push("What times work for you?");

  return lines.join("\n");
}

function buildGenericReminderMessage(friends: string[], additionalContext?: string): string {
  const greeting = friends.length > 0 ? `${friends.join(", ")} -` : "Hey -";
  const lines = [
    greeting,
    "",
    "Quick reminder about our collab plans.",
  ];

  if (additionalContext?.trim()) {
    lines.push("");
    lines.push(additionalContext.trim());
  }

  lines.push("");
  lines.push("Let me know what still works on your side.");

  return lines.join("\n");
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const data = generateMessageSchema.parse(body);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { timezone: true },
    });
    const timezone = profile?.timezone ?? "UTC";

    const event = data.eventId
      ? await prisma.event.findFirst({
          where: { id: data.eventId, userId: user.id },
          include: {
            participants: {
              include: {
                friend: {
                  select: { id: true, displayName: true, username: true, isMe: true },
                },
              },
            },
          },
        })
      : null;

    if (data.eventId && !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const selectedFriends = data.friendIds?.length
      ? await prisma.friend.findMany({
          where: { id: { in: data.friendIds }, userId: user.id },
          select: { id: true, displayName: true, username: true, isMe: true },
        })
      : [];

    const fallbackEventFriends = event
      ? event.participants
          .map((participant) => participant.friend)
          .filter((friend) => !friend.isMe)
      : [];

    const friendMentions = uniqueMentions(
      (selectedFriends.length > 0 ? selectedFriends : fallbackEventFriends).filter((friend) => !friend.isMe)
    );

    const additionalContext = data.additionalContext?.trim() || undefined;

    if (!event && friendMentions.length === 0 && !additionalContext) {
      return NextResponse.json(
        { error: "Select an event, at least one friend, or add extra context." },
        { status: 400 }
      );
    }

    const content = event
      ? data.messageType === "invite"
        ? buildInviteMessage({
            eventTitle: event.title,
            startTime: event.startTime,
            gameName: event.gameName || undefined,
            friends: friendMentions,
            googleCalendarLink: event.googleCalendarLink || undefined,
            timezone,
            additionalContext,
          })
        : buildReminderMessage({
            eventTitle: event.title,
            startTime: event.startTime,
            gameName: event.gameName || undefined,
            friends: friendMentions,
            googleCalendarLink: event.googleCalendarLink || undefined,
            timezone,
            additionalContext,
          })
      : data.messageType === "invite"
        ? buildGenericInviteMessage(friendMentions, additionalContext)
        : buildGenericReminderMessage(friendMentions, additionalContext);

    await prisma.messageLog.create({
      data: {
        userId: user.id,
        eventId: event?.id,
        messageType: data.messageType,
        content,
      },
    });

    return NextResponse.json({ content, timezone });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to generate message" }, { status: 500 });
  }
}
