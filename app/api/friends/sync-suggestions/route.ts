import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { getUserByUsername } from "@/lib/twitch/client";
import { detectCollabSignals } from "@/lib/twitch/detectCollabs";

export async function POST() {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const userId = user.id;

  try {
    // Fetch active non-me friends
    const activeFriends = await prisma.friend.findMany({
      where: { userId, isMe: false, isActive: true },
      select: { id: true, username: true, twitchId: true },
    });

    // Refresh collab signals for all friends (fire-and-forget per friend, limit errors)
    await Promise.allSettled(activeFriends.map((f) => detectCollabSignals(f.id)));

    // Collect dismissed usernames (isActive=false)
    const dismissedFriends = await prisma.friend.findMany({
      where: { userId, isActive: false },
      select: { username: true },
    });
    const dismissed = new Set(dismissedFriends.map((f) => f.username.toLowerCase()));

    // Collect existing active friend usernames
    const existing = new Set(activeFriends.map((f) => f.username.toLowerCase()));

    // Collect collab signal partner logins for all active friends
    const signals = await prisma.collabSignal.findMany({
      where: {
        friendId: { in: activeFriends.map((f) => f.id) },
        partnerLogin: { not: "" },
      },
      select: { partnerLogin: true },
    });

    const candidates = new Set<string>();
    for (const signal of signals) {
      const login = signal.partnerLogin.toLowerCase();
      if (!existing.has(login) && !dismissed.has(login)) {
        candidates.add(login);
      }
    }

    // Process up to 20 suggestions
    const usernames = Array.from(candidates).slice(0, 20);
    let added = 0;

    for (const username of usernames) {
      try {
        const twitchUser = await getUserByUsername(username);
        if (!twitchUser) continue;

        // Skip if already exists (active or inactive)
        const existingFriend = await prisma.friend.findFirst({
          where: { userId, username: twitchUser.login },
        });
        if (existingFriend) continue;

        await prisma.friend.upsert({
          where: { userId_username: { userId, username: twitchUser.login } },
          create: {
            userId,
            twitchId: twitchUser.id,
            username: twitchUser.login,
            displayName: twitchUser.display_name,
            avatarUrl: twitchUser.profile_image_url,
            isSuggested: true,
            isActive: true,
          },
          update: {},
        });
        added++;
      } catch {
        // Skip failed suggestions
      }
    }

    const total = await prisma.friend.count({
      where: { userId, isSuggested: true, isActive: true },
    });

    return NextResponse.json({ added, total });
  } catch (err) {
    return NextResponse.json({ error: "Failed to sync suggestions" }, { status: 500 });
  }
}
