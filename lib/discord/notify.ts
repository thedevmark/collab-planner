import { prisma } from "@/lib/db";
import {
  postWebhookMessage,
  buildNewEventEmbed,
  buildConfirmedEmbed,
  buildReminderEmbed,
  buildCanceledEmbed,
  buildInviteEmbed,
  createGuildScheduledEvent,
  updateGuildScheduledEvent,
  deleteGuildScheduledEvent,
  getDiscordToken,
  DiscordApiError,
} from "./client";
import { getDefaultDiscordCoverImage } from "./coverImage";

/**
 * Map a raw Discord API failure to a short, user-facing code. Kept intentionally
 * coarse — the UI decides how to phrase each bucket, not this module.
 */
function classifyDiscordError(err: unknown): string {
  if (err instanceof DiscordApiError) {
    if (err.status === 403) return "missing_permission";
    if (err.status === 401) return "auth_expired";
    if (err.status === 404) return "not_found";
    return `http_${err.status}`;
  }
  return "unknown";
}

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

/**
 * Create a native Discord Scheduled Event in the user's connected server.
 *
 * Shows up in the server's Events tab with the collab title, time, and a
 * "Twitch" external location. Fires once on event creation.
 *
 * Returns the Discord event ID on success so the caller can persist it for
 * later edit/delete sync. Records a short error code (e.g. "missing_permission")
 * on the Event row when Discord rejects the request — the UI reads this to
 * show the user a specific note instead of pretending everything worked.
 *
 * Still fire-and-forget for the API response path — we never throw out of
 * this function.
 */
export async function createDiscordScheduledEvent(
  userId: string,
  eventId: number,
  event: {
    title: string;
    description: string;
    startTime: Date;
    endTime: Date;
  },
) {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { discordGuildId: true },
    });
    if (!profile?.discordGuildId) return;

    const token = await getDiscordToken(userId);
    if (!token) return;

    const created = await createGuildScheduledEvent(profile.discordGuildId, token, {
      // Discord caps: name ≤100 chars, description ≤1000 chars
      name: event.title.slice(0, 100),
      description: event.description.slice(0, 1000),
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
      // Brand cover image so the event looks like ours in the Events tab,
      // not a plain colored header. Returns null if the logo file is
      // missing — Discord simply omits the banner in that case.
      image: getDefaultDiscordCoverImage() ?? undefined,
    });

    await prisma.event.update({
      where: { id: eventId },
      data: { discordEventId: created.id, discordSyncError: "" },
    });
  } catch (err) {
    const code = classifyDiscordError(err);
    // Record the failure so the event detail page can surface it. Don't
    // re-throw — the webhook embed still posts, and the user's own row in
    // the DB is already written.
    try {
      await prisma.event.update({
        where: { id: eventId },
        data: { discordSyncError: code },
      });
    } catch {
      // If even the error write fails, swallow — telemetry will be elsewhere.
    }
  }
}

/**
 * Patch the Discord scheduled event to match the current Event row. Called
 * after a successful PATCH on our side. No-op if we never created a Discord
 * event for this row (no stored ID).
 */
export async function updateDiscordScheduledEvent(
  userId: string,
  eventId: number,
  discordEventId: string,
  changes: {
    title?: string;
    description?: string;
    startTime?: Date;
    endTime?: Date;
    status?: "planned" | "confirmed" | "completed" | "canceled";
  },
) {
  if (!discordEventId) return;
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { discordGuildId: true },
    });
    if (!profile?.discordGuildId) return;

    const token = await getDiscordToken(userId);
    if (!token) return;

    // Map our app status vocabulary onto Discord's. "planned" = scheduled,
    // "confirmed" stays scheduled (Discord has no "confirmed" — the event is
    // just on the calendar), "completed" and "canceled" terminate it.
    const discordStatus = changes.status === undefined
      ? undefined
      : changes.status === "completed"
        ? "completed" as const
        : changes.status === "canceled"
          ? "canceled" as const
          : undefined;

    await updateGuildScheduledEvent(profile.discordGuildId, discordEventId, token, {
      name: changes.title?.slice(0, 100),
      description: changes.description?.slice(0, 1000),
      startTime: changes.startTime?.toISOString(),
      endTime: changes.endTime?.toISOString(),
      status: discordStatus,
    });

    await prisma.event.update({
      where: { id: eventId },
      data: { discordSyncError: "" },
    });
  } catch (err) {
    const code = classifyDiscordError(err);
    try {
      await prisma.event.update({
        where: { id: eventId },
        data: { discordSyncError: code },
      });
    } catch {}
  }
}

/**
 * Delete the Discord scheduled event. Called when the app event is deleted
 * outright. For cancellation we PATCH status=canceled instead (via
 * updateDiscordScheduledEvent) so the event stays visible as "canceled" in
 * the server's event tab rather than disappearing.
 */
export async function deleteDiscordScheduledEvent(
  userId: string,
  discordEventId: string,
) {
  if (!discordEventId) return;
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { discordGuildId: true },
    });
    if (!profile?.discordGuildId) return;

    const token = await getDiscordToken(userId);
    if (!token) return;

    await deleteGuildScheduledEvent(profile.discordGuildId, discordEventId, token);
  } catch {
    // Best-effort cleanup — if it fails the row is gone on our side anyway.
  }
}

/**
 * Post a smart-link invite to the user's Discord webhook when they create one.
 * Fire-and-forget — never blocks the API response.
 */
export async function notifyDiscordInviteCreated(
  userId: string,
  invite: {
    title: string;
    gameName: string;
    message: string;
    expiresAt: Date | null;
    participantDisplayNames: string[];
  },
  inviteUrl: string,
) {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { discordWebhookUrl: true, timezone: true },
    });
    if (!profile?.discordWebhookUrl) return;

    const embed = buildInviteEmbed({
      title: invite.title,
      gameName: invite.gameName || undefined,
      message: invite.message || undefined,
      participants: invite.participantDisplayNames,
      inviteUrl,
      expiresAt: invite.expiresAt ?? new Date(Date.now() + 7 * 86400000),
      timezone: profile.timezone ?? "UTC",
    });

    await postWebhookMessage(profile.discordWebhookUrl, embed);
  } catch {
    // Fire-and-forget
  }
}
