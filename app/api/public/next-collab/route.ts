import { prisma } from "@/lib/db";
import { publicApiJson, publicApiPreflight } from "@/lib/publicApiCors";
import { normalizeParticipantsInviteStatus } from "@/lib/participantStatus";

export async function OPTIONS(req: Request) {
  return publicApiPreflight(req);
}

/**
 * Next upcoming confirmed collab event for a user.
 *
 * Query:  ?user=<twitchLogin>
 * Returns:
 *   - 200 { event: { id, title, startTime, endTime, gameName, participants: [...] } | null }
 *   - 403 { error: "not_enabled" } — user exists but has not opted into public API
 *   - 404 { error: "user_not_found" }
 *   - 400 { error: "missing_user" }
 *
 * Only events with status in ("planned", "confirmed") and startTime >= now are returned.
 * Participant list includes displayName + login + avatar of each confirmed collaborator,
 * filtered to exclude the subject user (so "w/" lists read correctly).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = url.searchParams.get("user")?.trim().toLowerCase();

  if (!user) {
    return publicApiJson(req, { error: "missing_user" }, 400);
  }

  try {
    const profile = await prisma.profile.findFirst({
      where: { username: { equals: user, mode: "insensitive" } },
    });

    if (!profile) {
      return publicApiJson(req, { error: "user_not_found" }, 404);
    }

    if (!profile.publicApiEnabled) {
      return publicApiJson(req, { error: "not_enabled" }, 403);
    }

    const now = new Date();
    const event = await prisma.event.findFirst({
      where: {
        userId: profile.id,
        status: { in: ["planned", "confirmed"] },
        startTime: { gte: now },
      },
      orderBy: { startTime: "asc" },
      include: {
        participants: {
          include: {
            friend: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isMe: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      return publicApiJson(req, { event: null });
    }

    const normalized = normalizeParticipantsInviteStatus(event.participants);
    const participants = normalized
      .filter((p) => !p.friend.isMe)
      .map((p) => ({
        displayName: p.friend.displayName,
        login: p.friend.username,
        avatarUrl: p.friend.avatarUrl,
        inviteStatus: p.inviteStatus,
      }));

    return publicApiJson(req, {
      event: {
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        gameName: event.gameName,
        status: event.status,
        participants,
      },
    });
  } catch (err) {
    console.error("[api/public/next-collab] GET failed:", err);
    return publicApiJson(req, { error: "internal_error" }, 500);
  }
}
