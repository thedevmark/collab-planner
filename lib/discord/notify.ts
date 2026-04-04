import { prisma } from "@/lib/db";
import {
  postWebhookMessage,
  buildNewEventEmbed,
  buildConfirmedEmbed,
  buildReminderEmbed,
  buildCanceledEmbed,
} from "./client";

interface EventData {
  id: number;
  title: string;
  startTime: Date;
  endTime: Date;
  gameName: string;
  participants: { friend: { displayName: string; isMe: boolean; discordUsername?: string | null; discordId?: string | null } }[];
}

export async function notifyDiscord(
  userId: string,
  type: "created" | "confirmed" | "canceled" | "reminder",
  event: EventData,
  reminderLabel?: string
) {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { discordWebhookUrl: true, timezone: true },
    });
    if (!profile?.discordWebhookUrl) return;

    const nonSelf = event.participants.filter((p) => !p.friend.isMe);

    const participants = nonSelf.map((p) =>
      p.friend.discordUsername
        ? `${p.friend.displayName} (@${p.friend.discordUsername})`
        : p.friend.displayName
    );

    // Build ping string for participants who have connected Discord
    const pings = nonSelf
      .filter((p) => p.friend.discordId)
      .map((p) => `<@${p.friend.discordId}>`)
      .join(" ");

    const embedData = {
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      gameName: event.gameName || undefined,
      participants,
      timezone: profile.timezone ?? "UTC",
    };

    let embed;
    if (type === "created") embed = buildNewEventEmbed(embedData);
    else if (type === "confirmed") embed = buildConfirmedEmbed(embedData);
    else if (type === "canceled") embed = buildCanceledEmbed({ title: event.title });
    else embed = buildReminderEmbed({ ...embedData, label: reminderLabel ?? "Reminder" });

    await postWebhookMessage(profile.discordWebhookUrl, embed, pings || undefined);
  } catch {
    // Fire-and-forget — never block the main response
  }
}
