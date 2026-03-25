import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";

const inviteActionSchema = z.object({
  action: z.enum(["accept", "decline", "claim"]),
});

function getInviteState(invite: {
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
}) {
  const now = new Date();
  return {
    expired: invite.expiresAt != null && invite.expiresAt < now,
    exhausted: invite.maxUses != null && invite.usedCount >= invite.maxUses,
  };
}

function getRecipientSummary(
  recipients: Array<{
    status: string;
    claimedAt: Date | null;
  }>
) {
  return {
    accepted: recipients.filter((recipient) => recipient.status === "accepted").length,
    declined: recipients.filter((recipient) => recipient.status === "declined").length,
    pending: recipients.filter((recipient) => recipient.status === "pending").length,
    claimed: recipients.filter((recipient) => recipient.claimedAt != null).length,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await prisma.collabInvite.findUnique({
    where: { token },
    include: {
      recipients: {
        orderBy: [{ status: "asc" }, { displayName: "asc" }],
      },
    },
  });

  if (!invite) {
    return NextResponse.json({
      valid: false,
      expired: false,
      exhausted: false,
      invite: null,
      summary: null,
    });
  }

  const { expired, exhausted } = getInviteState(invite);

  return NextResponse.json({
    valid: true,
    expired,
    exhausted,
    invite,
    summary: getRecipientSummary(invite.recipients),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { token } = await params;

  try {
    const body = await req.json();
    const { action } = inviteActionSchema.parse(body);

    const [invite, profile] = await Promise.all([
      prisma.collabInvite.findUnique({
        where: { token },
        include: {
          recipients: true,
        },
      }),
      prisma.profile.findUnique({
        where: { id: user.id },
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      }),
    ]);

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { expired } = getInviteState(invite);
    if (expired) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 400 });
    }

    const username = profile.username.toLowerCase();
    const now = new Date();

    const recipient = await prisma.collabInviteRecipient.upsert({
      where: {
        inviteId_username: {
          inviteId: invite.id,
          username,
        },
      },
      create: {
        inviteId: invite.id,
        username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        status: action === "accept" ? "accepted" : action === "decline" ? "declined" : "pending",
        respondedAt: action === "claim" ? null : now,
        claimedAt: action === "claim" ? now : null,
        claimedByUserId: action === "claim" ? user.id : null,
      },
      update: {
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        ...(action === "accept"
          ? { status: "accepted", respondedAt: now }
          : action === "decline"
          ? { status: "declined", respondedAt: now }
          : { claimedAt: now, claimedByUserId: user.id }),
      },
    });

    const recipients = await prisma.collabInviteRecipient.findMany({
      where: { inviteId: invite.id },
      orderBy: [{ status: "asc" }, { displayName: "asc" }],
    });

    return NextResponse.json({
      ok: true,
      recipient,
      summary: getRecipientSummary(recipients),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to update invite" }, { status: 500 });
  }
}
