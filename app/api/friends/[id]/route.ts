import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  notes: z.string().optional(),
  displayName: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const friend = await prisma.friend.findUnique({
      where: { id: parseInt(id) },
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
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch friend" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

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
  try {
    const { id } = await params;
    await prisma.friend.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to remove friend" }, { status: 500 });
  }
}
