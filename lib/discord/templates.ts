export interface DiscordMessageContext {
  eventTitle: string;
  startTime: Date;
  gameName?: string;
  friends: string[];
  googleCalendarLink?: string;
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

// Simple fallback templates (used when AI is unavailable)
export function buildInviteMessage(ctx: DiscordMessageContext): string {
  const timeStr = formatDateTime(ctx.startTime);
  const game = ctx.gameName ? ` playing **${ctx.gameName}**` : "";
  const gcal = ctx.googleCalendarLink ? `\n\nAdd to your calendar: ${ctx.googleCalendarLink}` : "";

  return `Hey ${ctx.friends.join(", ")}! 👋

Want to do a collab stream${game}?

🗓️ **${ctx.eventTitle}**
📅 ${timeStr}${gcal}

You in? 🎮`;
}

export function buildReminderMessage(ctx: DiscordMessageContext): string {
  const timeStr = formatDateTime(ctx.startTime);
  const game = ctx.gameName ? ` (${ctx.gameName})` : "";
  const gcal = ctx.googleCalendarLink ? `\nCalendar: ${ctx.googleCalendarLink}` : "";

  return `🔔 Reminder: **${ctx.eventTitle}**${game} is coming up!

📅 ${timeStr}${gcal}

See you there! 🎮`;
}
