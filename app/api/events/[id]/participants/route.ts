import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { z } from "zod";
import {
  normalizeParticipantInviteStatus,
  normalizeParticipantResponseStatus,
  PARTICIPANT_RESPONSE_STATUS_INPUTS,
} from "@/lib/participantStatus";

const addParticipantSchema = z.object({ friendId: z.number() });
const updateParticipantSchema = z.object({
  participantId: z.number(),
  inviteStatus: z.enum(PARTICIPANT_RESPONSE_STATUS_INPUTS),
});
const removeParticipantSchema = z.object({ participantId: z.number() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const eventId = parseInt(id);
    const body = await req.json();
    const { friendId } = addParticipantSchema.parse(body);

    // Verify both event and friend belong to this user
    const [event, friend] = await Promise.all([
      prisma.event.findFirst({ where: { id: eventId, userId: user.id } }),
      prisma.friend.findFirst({ where: { id: friendId, userId: user.id } }),
    ]);
    if (!event || !friend) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const participant = await prisma.eventParticipant.create({
      data: { eventId, friendId },
      include: {
        friend: { select: { id: true, username: true, displayName: true, avatarUrl: true, isMe: true } },
      },
    });
    return NextResponse.json(normalizeParticipantInviteStatus(participant), { status: 201 });
  } catch (err) {
    console.error("[api/events/[id]/participants] POST failed:", err);
    return NextResponse.json({ error: "Failed to add participant" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const { participantId, inviteStatus } = updateParticipantSchema.parse(body);
    const normalizedInviteStatus = normalizeParticipantResponseStatus(inviteStatus);

    // Verify participant belongs to user's event
    const participant = await prisma.eventParticipant.findFirst({
      where: { id: participantId, event: { userId: user.id } },
    });
    if (!participant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.eventParticipant.update({
      where: { id: participantId },
      data: { inviteStatus: normalizedInviteStatus },
    });
    return NextResponse.json(normalizeParticipantInviteStatus(updated));
  } catch (err) {
    console.error("[api/events/[id]/participants] PATCH failed:", err);
    return NextResponse.json({ error: "Failed to update participant" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const { participantId } = removeParticipantSchema.parse(body);

    const participant = await prisma.eventParticipant.findFirst({
      where: { id: participantId, event: { userId: user.id } },
    });
    if (!participant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.eventParticipant.delete({ where: { id: participantId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/events/[id]/participants] DELETE failed:", err);
    return NextResponse.json({ error: "Failed to remove participant" }, { status: 500 });
  }
}
