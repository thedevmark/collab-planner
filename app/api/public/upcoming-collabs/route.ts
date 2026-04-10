import { prisma } from "@/lib/db";
import { publicApiJson, publicApiPreflight } from "@/lib/publicApiCors";
import { normalizeParticipantsInviteStatus } from "@/lib/participantStatus";

export async function OPTIONS(req: Request) {
  return publicApiPreflight(req);
}

/**
 * Upcoming confirmed collab events for a user.
 *
 * Query:
 *   user=<twitchLogin>  (required)
 *   limit=<1-25>        (optional, default 5)
 *
 * Returns:
 *   200 { events: [ { id, title, startTime, endTime, gameName, status, participants } ] }
 *   403 { error: "not_enabled" }
 *   404 { error: "user_not_found" }
 *   400 { error: "missing_user" }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = url.searchParams.get("user")?.trim().toLowerCase();
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "5", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(25, Math.max(1, limitRaw)) : 5;

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
    const events = await prisma.event.findMany({
      where: {
        userId: profile.id,
        status: { in: ["planned", "confirmed"] },
        startTime: { gte: now },
      },
      orderBy: { startTime: "asc" },
      take: limit,
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

    const shaped = events.map((event) => {
      const normalized = normalizeParticipantsInviteStatus(event.participants);
      const participants = normalized
        .filter((p) => !p.friend.isMe)
        .map((p) => ({
          displayName: p.friend.displayName,
          login: p.friend.username,
          avatarUrl: p.friend.avatarUrl,
          inviteStatus: p.inviteStatus,
        }));

      return {
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        gameName: event.gameName,
        status: event.status,
        participants,
      };
    });

    return publicApiJson(req, { events: shaped });
  } catch (err) {
    console.error("[api/public/upcoming-collabs] GET failed:", err);
    return publicApiJson(req, { error: "internal_error" }, 500);
  }
}
