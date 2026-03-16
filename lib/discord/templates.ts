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
  const gameLine = ctx.gameName ? `Game: ${ctx.gameName}` : "Game: TBD";
  const calendarLine = ctx.googleCalendarLink ? `\nCalendar: ${ctx.googleCalendarLink}` : "";

  return `${ctx.friends.join(", ")} -

Want to run this collab?

${ctx.eventTitle}
${timeStr}
${gameLine}${calendarLine}

You in?`;
}

export function buildReminderMessage(ctx: DiscordMessageContext): string {
  const timeStr = formatDateTime(ctx.startTime);
  const gameLine = ctx.gameName ? `Game: ${ctx.gameName}\n` : "";
  const calendarLine = ctx.googleCalendarLink ? `Calendar: ${ctx.googleCalendarLink}\n` : "";

  return `Reminder.

${ctx.eventTitle}
${timeStr}
${gameLine}${calendarLine}`.trim();
}
