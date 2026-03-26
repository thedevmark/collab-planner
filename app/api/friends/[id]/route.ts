import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { backfillStoredStreamHistoryGameNames } from "@/lib/twitch/fetchStreamHistory";
import { z } from "zod";

const updateSchema = z.object({
  notes: z.string().optional(),
  displayName: z.string().optional(),
  isSuggested: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const friendId = parseInt(id);
    await backfillStoredStreamHistoryGameNames(friendId).catch(() => {});

    const friend = await prisma.friend.findFirst({
      where: { id: friendId, userId: user.id },
      include: {
        streamHistory: {
          orderBy: { startTime: "desc" },
          take: 30,
        },
        scheduleSegments: {
          orderBy: { startTime: "asc" },
          take: 25,
        },
        collabHistories: {
          orderBy: { date: "desc" },
          take: 10,
          include: { event: { select: { id: true, title: true } } },
        },
        participants: {
          include: { event: true },
        },
      },
    });

    if (!friend) return NextResponse.json({ error: "Friend not found" }, { status: 404 });
    return NextResponse.json(friend);
  } catch {
    return NextResponse.json({ error: "Failed to fetch friend" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.friend.findFirst({ where: { id: parseInt(id), userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Friend not found" }, { status: 404 });

    const friend = await prisma.friend.update({
      where: { id: parseInt(id) },
      data,
    });
    return NextResponse.json(friend);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update friend" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const existing = await prisma.friend.findFirst({ where: { id: parseInt(id), userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Friend not found" }, { status: 404 });

    await prisma.friend.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to remove friend" }, { status: 500 });
  }
}
