import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { notifyDiscord } from "@/lib/discord/notify";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const now = new Date();
    const pending = await prisma.reminder.findMany({
      where: {
        remindAt: { lte: now },
        sent: false,
        event: { userId: user.id },
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            gameName: true,
            participants: {
              include: { friend: { select: { displayName: true, isMe: true, discordUsername: true, discordId: true } } },
            },
          },
        },
      },
    });

    if (pending.length > 0) {
      await prisma.reminder.updateMany({
        where: { id: { in: pending.map((r) => r.id) } },
        data: { sent: true },
      });

      // Fire Discord reminder notifications (fire-and-forget)
      for (const r of pending) {
        notifyDiscord(user.id, "reminder", r.event, r.label || "Reminder");
      }
    }

    return NextResponse.json(pending.map((r) => ({ id: r.id, label: r.label, event: { id: r.event.id, title: r.event.title } })));
  } catch (err) {
    console.error("[api/reminders/pending] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch pending reminders" }, { status: 500 });
  }
}
