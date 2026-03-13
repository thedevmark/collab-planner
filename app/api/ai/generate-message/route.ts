import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateText } from "@/lib/gemini/client";
import { buildDiscordMessagePrompt } from "@/lib/gemini/prompts";
import { buildInviteMessage, buildReminderMessage } from "@/lib/discord/templates";
import { z } from "zod";
import { format } from "date-fns";

const schema = z.object({
  messageType: z.enum(["invite", "reminder"]),
  eventId: z.number().optional(),
  eventTitle: z.string().optional(),
  startTime: z.string().optional(),
  gameName: z.string().optional(),
  friendIds: z.array(z.number()).optional(),
  additionalContext: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    let eventTitle = data.eventTitle ?? "Collab Stream";
    let startTime = data.startTime ?? new Date().toISOString();
    let gameName = data.gameName ?? "";
    let googleCalendarLink = "";
    let friends: string[] = [];

    if (data.eventId) {
      const event = await prisma.event.findUnique({
        where: { id: data.eventId },
        include: {
          participants: { include: { friend: true } },
        },
      });
      if (event) {
        eventTitle = event.title;
        startTime = event.startTime.toISOString();
        gameName = event.gameName;
        googleCalendarLink = event.googleCalendarLink;
        friends = event.participants.map((p) => p.friend.displayName);
      }
    } else if (data.friendIds?.length) {
      const dbFriends = await prisma.friend.findMany({ where: { id: { in: data.friendIds } } });
      friends = dbFriends.map((f) => f.displayName);
    }

    const formattedTime = format(new Date(startTime), "EEEE, MMMM d 'at' h:mm a");

    let content: string;
    try {
      const prompt = buildDiscordMessagePrompt({
        messageType: data.messageType,
        eventTitle,
        startTime: formattedTime,
        gameName,
        friends,
        additionalContext: data.additionalContext,
      });
      content = await generateText(prompt);
    } catch {
      // Fallback to template if AI fails
      const ctx = {
        eventTitle,
        startTime: new Date(startTime),
        gameName,
        friends,
        googleCalendarLink: googleCalendarLink || undefined,
      };
      content = data.messageType === "invite" ? buildInviteMessage(ctx) : buildReminderMessage(ctx);
    }

    // Log the message
    await prisma.messageLog.create({
      data: {
        eventId: data.eventId,
        messageType: data.messageType,
        content,
      },
    });

    return NextResponse.json({ content, messageType: data.messageType });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: `Failed to generate message: ${err instanceof Error ? err.message : "Unknown"}` }, { status: 500 });
  }
}
