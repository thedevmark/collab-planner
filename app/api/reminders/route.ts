import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { z } from "zod";

const createSchema = z.object({
  eventId: z.number(),
  remindAt: z.string(),
  label: z.string().optional(),
});

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    const reminders = await prisma.reminder.findMany({
      where: {
        event: { userId: user.id },
        ...(eventId && { eventId: parseInt(eventId) }),
      },
      include: { event: { select: { id: true, title: true } } },
      orderBy: { remindAt: "asc" },
    });
    return NextResponse.json(reminders);
  } catch (err) {
    console.error("[api/reminders] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const event = await prisma.event.findFirst({ where: { id: data.eventId, userId: user.id } });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const reminder = await prisma.reminder.create({
      data: {
        eventId: data.eventId,
        remindAt: new Date(data.remindAt),
        label: data.label ?? "",
      },
    });
    return NextResponse.json(reminder, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    console.error("[api/reminders] POST failed:", err);
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}
