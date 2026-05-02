import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createOrConfirmFriendFromTwitchUser } from "@/lib/friends/createFriend";
import { refreshTwitchUserToken } from "@/lib/twitch/auth";
import { getChannelFollowers, getFollowedChannels, getUsersByIds, getUsersByLogins } from "@/lib/twitch/client";

const importFollowersSchema = z.object({
  usernames: z.array(z.string().min(1)).min(1).max(50),
});

const importSourceSchema = z.enum(["followers", "following"]).default("followers");

function normalizeLogin(login: string) {
  return login.trim().replace(/^@/, "").toLowerCase();
}

function followerPermissionError() {
  return NextResponse.json(
    {
      error: "Reconnect Twitch to import Twitch accounts.",
      code: "twitch_followers_permission_required",
    },
    { status: 409 }
  );
}

type ImportCandidate = {
  twitchId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  followedAt: string;
};

async function fetchImportCandidates(
  source: z.infer<typeof importSourceSchema>,
  twitchId: string,
  userToken: string
): Promise<{ followers: ImportCandidate[]; total: number; capped: boolean }> {
  if (source === "following") {
    const { channels, total, capped } = await getFollowedChannels(twitchId, userToken);
    const users = await getUsersByIds(channels.map((channel) => channel.broadcaster_id));
    const usersById = new Map(users.map((twitchUser) => [twitchUser.id, twitchUser]));

    return {
      total,
      capped,
      followers: channels.map((channel) => {
        const twitchUser = usersById.get(channel.broadcaster_id);
        return {
          twitchId: channel.broadcaster_id,
          username: twitchUser?.login ?? channel.broadcaster_login,
          displayName: twitchUser?.display_name ?? channel.broadcaster_name,
          avatarUrl: twitchUser?.profile_image_url ?? "",
          followedAt: channel.followed_at,
        };
      }),
    };
  }

  const { followers, total, capped } = await getChannelFollowers(twitchId, userToken);
  const users = await getUsersByIds(followers.map((follower) => follower.user_id));
  const usersById = new Map(users.map((twitchUser) => [twitchUser.id, twitchUser]));

  return {
    total,
    capped,
    followers: followers.map((follower) => {
      const twitchUser = usersById.get(follower.user_id);
      return {
        twitchId: follower.user_id,
        username: twitchUser?.login ?? follower.user_login,
        displayName: twitchUser?.display_name ?? follower.user_name,
        avatarUrl: twitchUser?.profile_image_url ?? "",
        followedAt: follower.followed_at,
      };
    }),
  };
}

function isFollowerPermissionError(err: unknown) {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes("401") ||
    err.message.includes("403") ||
    err.message.includes("Twitch user token refresh failed")
  );
}

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const source = importSourceSchema.parse(new URL(req.url).searchParams.get("source") ?? "followers");
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { twitchId: true, twitchAccessToken: true, twitchRefreshToken: true },
    });

    if (!profile?.twitchId || (!profile.twitchAccessToken && !profile.twitchRefreshToken)) {
      return followerPermissionError();
    }

    let followerData: Awaited<ReturnType<typeof fetchImportCandidates>>;
    try {
      if (!profile.twitchAccessToken) throw new Error("missing access token");
      followerData = await fetchImportCandidates(source, profile.twitchId, profile.twitchAccessToken);
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
      followerData = await fetchImportCandidates(source, profile.twitchId, refreshed.access_token);
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
        !existingTwitchIds.has(follower.twitchId) &&
        !existingLogins.has(normalizeLogin(follower.username))
    );

    return NextResponse.json({
      total,
      capped,
      existingCount: followers.length - importableFollowers.length,
      followers: importableFollowers,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose a valid Twitch import source." }, { status: 400 });
    }

    if (isFollowerPermissionError(err)) {
      return followerPermissionError();
    }

    console.error("[api/friends/import-followers] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch Twitch accounts" }, { status: 500 });
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
    return NextResponse.json({ error: "Failed to import Twitch accounts" }, { status: 500 });
  }
}
