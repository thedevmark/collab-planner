import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const addParticipantSchema = z.object({ friendId: z.number() });
const updateParticipantSchema = z.object({
  participantId: z.number(),
  inviteStatus: z.enum(["pending", "accepted", "declined"]),
});
const removeParticipantSchema = z.object({ participantId: z.number() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { friendId } = addParticipantSchema.parse(body);

    const participant = await prisma.eventParticipant.create({
      data: { eventId: parseInt(id), friendId },
      include: {
        friend: { select: { id: true, username: true, displayName: true, avatarUrl: true, isMe: true } },
      },
    });
    return NextResponse.json(participant, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to add participant" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { participantId, inviteStatus } = updateParticipantSchema.parse(body);

    const participant = await prisma.eventParticipant.update({
      where: { id: participantId },
      data: { inviteStatus },
    });
    return NextResponse.json(participant);
  } catch (err) {
    return NextResponse.json({ error: "Failed to update participant" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { participantId } = removeParticipantSchema.parse(body);

    await prisma.eventParticipant.delete({ where: { id: participantId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to remove participant" }, { status: 500 });
  }
}
