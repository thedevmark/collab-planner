import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  eventId: z.number(),
  remindAt: z.string(),
  label: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    const reminders = await prisma.reminder.findMany({
      where: { ...(eventId && { eventId: parseInt(eventId) }) },
      include: { event: { select: { id: true, title: true } } },
      orderBy: { remindAt: "asc" },
    });
    return NextResponse.json(reminders);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = createSchema.parse(body);

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
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}
