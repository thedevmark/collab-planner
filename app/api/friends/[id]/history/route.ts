import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { z } from "zod";

const historySchema = z.object({
  title: z.string().min(1),
  gameName: z.string().optional(),
  date: z.string(),
  notes: z.string().optional(),
  eventId: z.number().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const friend = await prisma.friend.findFirst({ where: { id: parseInt(id), userId: user.id } });
    if (!friend) return NextResponse.json({ error: "Friend not found" }, { status: 404 });

    const history = await prisma.collabHistory.findMany({
      where: { friendId: parseInt(id) },
      orderBy: { date: "desc" },
      include: { event: { select: { id: true, title: true } } },
    });
    return NextResponse.json(history);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const friend = await prisma.friend.findFirst({ where: { id: parseInt(id), userId: user.id } });
    if (!friend) return NextResponse.json({ error: "Friend not found" }, { status: 404 });

    const body = await req.json();
    const data = historySchema.parse(body);

    const entry = await prisma.collabHistory.create({
      data: {
        friendId: parseInt(id),
        title: data.title,
        gameName: data.gameName ?? "",
        date: new Date(data.date),
        notes: data.notes ?? "",
        eventId: data.eventId,
      },
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create history entry" }, { status: 500 });
  }
}
