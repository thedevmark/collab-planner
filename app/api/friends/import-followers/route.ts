import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createOrConfirmFriendFromTwitchUser } from "@/lib/friends/createFriend";
import { refreshTwitchUserToken } from "@/lib/twitch/auth";
import { getChannelFollowers, getUsersByIds, getUsersByLogins } from "@/lib/twitch/client";

const importFollowersSchema = z.object({
  usernames: z.array(z.string().min(1)).min(1).max(50),
});

function normalizeLogin(login: string) {
  return login.trim().replace(/^@/, "").toLowerCase();
}

function followerPermissionError() {
  return NextResponse.json(
    {
      error: "Reconnect Twitch to allow follower import.",
      code: "twitch_followers_permission_required",
    },
    { status: 409 }
  );
}

function isFollowerPermissionError(err: unknown) {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes("401") ||
    err.message.includes("403") ||
    err.message.includes("Twitch user token refresh failed")
  );
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { twitchId: true, twitchAccessToken: true, twitchRefreshToken: true },
    });

    if (!profile?.twitchId || (!profile.twitchAccessToken && !profile.twitchRefreshToken)) {
      return followerPermissionError();
    }

    let followerData: Awaited<ReturnType<typeof getChannelFollowers>>;
    try {
      if (!profile.twitchAccessToken) throw new Error("missing access token");
      followerData = await getChannelFollowers(profile.twitchId, profile.twitchAccessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (!profile.twitchRefreshToken || (!message.includes("401") && !message.includes("missing access token"))) {
        throw err;
      }

      let refreshed: Awaited<ReturnType<typeof refreshTwitchUserToken>>;
      try {
        refreshed = await refreshTwitchUserToken(profile.twitchRefreshToken);
      } catch (refreshErr) {
        if (isFollowerPermissionError(refreshErr)) {
          return followerPermissionError();
        }
        throw refreshErr;
      }
      await prisma.profile.update({
        where: { id: user.id },
        data: {
          twitchAccessToken: refreshed.access_token,
          twitchRefreshToken: refreshed.refresh_token ?? profile.twitchRefreshToken,
          twitchTokenExpiry: new Date(Date.now() + refreshed.expires_in * 1000),
        },
        select: { id: true },
      });
      followerData = await getChannelFollowers(profile.twitchId, refreshed.access_token);
    }

    const existingFriends = await prisma.friend.findMany({
      where: { userId: user.id, isActive: true },
      select: { twitchId: true, username: true },
    });
    const { followers, total, capped } = followerData;

    const existingTwitchIds = new Set(existingFriends.map((friend) => friend.twitchId));
    const existingLogins = new Set(existingFriends.map((friend) => normalizeLogin(friend.username)));
    const importableFollowers = followers.filter(
      (follower) =>
        !existingTwitchIds.has(follower.user_id) &&
        !existingLogins.has(normalizeLogin(follower.user_login))
    );

    const users = await getUsersByIds(importableFollowers.map((follower) => follower.user_id));
    const usersById = new Map(users.map((twitchUser) => [twitchUser.id, twitchUser]));

    return NextResponse.json({
      total,
      capped,
      existingCount: followers.length - importableFollowers.length,
      followers: importableFollowers.map((follower) => {
        const twitchUser = usersById.get(follower.user_id);
        return {
          twitchId: follower.user_id,
          username: twitchUser?.login ?? follower.user_login,
          displayName: twitchUser?.display_name ?? follower.user_name,
          avatarUrl: twitchUser?.profile_image_url ?? "",
          followedAt: follower.followed_at,
        };
      }),
    });
  } catch (err) {
    if (isFollowerPermissionError(err)) {
      return followerPermissionError();
    }

    console.error("[api/friends/import-followers] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch Twitch followers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const { usernames } = importFollowersSchema.parse(body);
    const requestedLogins = [...new Set(usernames.map(normalizeLogin).filter(Boolean))];

    const twitchUsers = await getUsersByLogins(requestedLogins);
    const foundLogins = new Set(twitchUsers.map((twitchUser) => twitchUser.login.toLowerCase()));
    const missing = requestedLogins.filter((login) => !foundLogins.has(login));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Could not find Twitch user${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}` },
        { status: 404 }
      );
    }

    const results = await Promise.allSettled(
      twitchUsers.map((twitchUser) =>
        createOrConfirmFriendFromTwitchUser(user.id, twitchUser, { isSuggested: false })
      )
    );

    const imported = results.filter(
      (result) =>
        result.status === "fulfilled" &&
        ["created", "reactivated", "confirmed"].includes(result.value.result)
    ).length;
    const skipped = results.filter(
      (result) => result.status === "fulfilled" && result.value.result === "existing"
    ).length;
    const failed = results.filter((result) => result.status === "rejected").length;

    return NextResponse.json({ imported, skipped, failed });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose between 1 and 50 Twitch users to import." }, { status: 400 });
    }

    console.error("[api/friends/import-followers] POST failed:", err);
    return NextResponse.json({ error: "Failed to import Twitch followers" }, { status: 500 });
  }
}
