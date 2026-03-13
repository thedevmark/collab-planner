import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();
    const pending = await prisma.reminder.findMany({
      where: { remindAt: { lte: now }, sent: false },
      include: { event: { select: { id: true, title: true } } },
    });

    if (pending.length > 0) {
      await prisma.reminder.updateMany({
        where: { id: { in: pending.map((r) => r.id) } },
        data: { sent: true },
      });
    }

    return NextResponse.json(pending);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch pending reminders" }, { status: 500 });
  }
}
