export interface DiscordMessageContext {
  eventTitle: string;
  startTime: Date;
  gameName?: string;
  friends: string[];
  googleCalendarLink?: string;
  timezone?: string;
  additionalContext?: string;
}

export function formatDateTime(date: Date, timezone = "UTC"): string {
  try {
    return date.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: timezone,
    });
  } catch {
    return date.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }
}

export function buildInviteMessage(ctx: DiscordMessageContext): string {
  const timeStr = formatDateTime(ctx.startTime, ctx.timezone);
  const greeting = ctx.friends.length > 0 ? `${ctx.friends.join(", ")} -` : "Hey -";
  const lines = [
    greeting,
    "",
    "Want to run this collab?",
    "",
    ctx.eventTitle,
    timeStr,
    ctx.gameName ? `Game: ${ctx.gameName}` : "Game: TBD",
  ];

  if (ctx.googleCalendarLink) {
    lines.push(`Calendar: ${ctx.googleCalendarLink}`);
  }

  if (ctx.additionalContext?.trim()) {
    lines.push("");
    lines.push(ctx.additionalContext.trim());
  }

  lines.push("");
  lines.push("You in?");

  return lines.join("\n");
}

export function buildReminderMessage(ctx: DiscordMessageContext): string {
  const timeStr = formatDateTime(ctx.startTime, ctx.timezone);
  const lines = [
    "Reminder.",
    "",
    ctx.eventTitle,
    timeStr,
  ];

  if (ctx.gameName) {
    lines.push(`Game: ${ctx.gameName}`);
  }

  if (ctx.googleCalendarLink) {
    lines.push(`Calendar: ${ctx.googleCalendarLink}`);
  }

  if (ctx.additionalContext?.trim()) {
    lines.push("");
    lines.push(ctx.additionalContext.trim());
  }

  return lines.join("\n").trim();
}
