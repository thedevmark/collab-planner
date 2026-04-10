import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { notifyDiscordInviteCreated } from "@/lib/discord/notify";
import { z } from "zod";

const createInviteSchema = z.object({
  participantFriendIds: z.array(z.number()).default([]),
  title: z.string().min(1).default("Collab Stream"),
  gameName: z.string().optional(),
  description: z.string().optional(),
  message: z.string().optional(),
  expiresIn: z.number().max(7 * 24).optional(),
  maxUses: z.number().nullable().optional(),
  postToDiscord: z.boolean().optional(),
});

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const userId = user.id;

  try {
    const body = await req.json();
    const data = createInviteSchema.parse(body);

    const meFriend = await prisma.friend.findFirst({
      where: { userId, isMe: true },
    });

    const participants =
      data.participantFriendIds.length > 0
        ? await prisma.friend.findMany({
            where: { id: { in: data.participantFriendIds }, userId, isMe: false },
          })
        : [];

    const recipientRows = Array.from(
      new Map(
        participants.map((participant) => [
          participant.username.toLowerCase(),
          {
            username: participant.username,
            displayName: participant.displayName,
            avatarUrl: participant.avatarUrl,
          },
        ])
      ).values()
    );

    const expiresAt =
      data.expiresIn != null
        ? new Date(Date.now() + data.expiresIn * 60 * 60 * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // default 7 days

    const invite = await prisma.collabInvite.create({
      data: {
        creatorUserId: userId,
        creatorDisplayName: meFriend?.displayName ?? "",
        creatorAvatarUrl: meFriend?.avatarUrl ?? "",
        creatorUsername: meFriend?.username ?? "",
        title: data.title,
        gameName: data.gameName ?? "",
        description: data.description ?? "",
        message: data.message ?? "",
        participantUsernames: participants.map((p) => p.username),
        participantDisplayNames: participants.map((p) => p.displayName),
        participantAvatarUrls: participants.map((p) => p.avatarUrl),
        expiresAt,
        maxUses: data.maxUses ?? null,
        recipients: recipientRows.length > 0 ? { create: recipientRows } : undefined,
      },
      include: {
        recipients: {
          orderBy: { displayName: "asc" },
        },
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const url = `${baseUrl}/invite/${invite.token}`;

    // Discord notification is available but only fires when the caller
    // explicitly requests it (postToDiscord: true in the request body).
    // Nothing auto-posts without user consent.
    if (data.postToDiscord) {
      void notifyDiscordInviteCreated(userId, invite, url);
    }

    return NextResponse.json({ token: invite.token, url, invite }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}
