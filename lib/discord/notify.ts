import { prisma } from "@/lib/db";
import {
  getDiscordToken,
  postChannelMessage,
  createGuildScheduledEvent,
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
  participants: { friend: { displayName: string; isMe: boolean } }[];
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
      select: { discordChannelId: true, discordGuildId: true, timezone: true },
    });
    if (!profile?.discordChannelId) return;

    const token = await getDiscordToken(userId);
    if (!token) return;

    const participants = event.participants
      .filter((p) => !p.friend.isMe)
      .map((p) => p.friend.displayName);

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

    await postChannelMessage(profile.discordChannelId, token, embed);

    // Create a Discord Scheduled Event when a collab is first planned
    if (type === "created" && profile.discordGuildId) {
      await createGuildScheduledEvent(profile.discordGuildId, token, {
        name: event.title,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        description: [
          participants.length > 0 ? `With: ${participants.join(", ")}` : "",
          event.gameName ? `Playing: ${event.gameName}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      });
    }
  } catch {
    // Fire-and-forget — never block the main response
  }
}
