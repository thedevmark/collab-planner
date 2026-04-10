import { prisma } from "@/lib/db";
import { publicApiJson, publicApiPreflight } from "@/lib/publicApiCors";

export async function OPTIONS(req: Request) {
  return publicApiPreflight(req);
}

/**
 * Public profile probe. Lets a caller check whether a given twitch login
 * has opted into the public collab API before calling the other endpoints.
 *
 * Query:  ?user=<twitchLogin>
 * Returns:
 *   - 200 { exists: true,  enabled: true,  displayName, avatarUrl, channelColor } — opted in
 *   - 200 { exists: true,  enabled: false } — found but not opted in
 *   - 200 { exists: false, enabled: false } — no such user
 *   - 400 { error: "missing_user" } — bad request
 *
 * Never returns 404, so a missing user doesn't look like a deploy problem.
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
      return publicApiJson(req, { exists: false, enabled: false });
    }

    if (!profile.publicApiEnabled) {
      return publicApiJson(req, { exists: true, enabled: false });
    }

    return publicApiJson(req, {
      exists: true,
      enabled: true,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      channelColor: profile.channelColor,
      timezone: profile.timezone,
    });
  } catch (err) {
    console.error("[api/public/profile] GET failed:", err);
    return publicApiJson(req, { error: "internal_error" }, 500);
  }
}
