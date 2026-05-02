import type { TwitchUser } from "@/lib/twitch/types";
import { prisma } from "@/lib/db";
import { getBroadcasterSchedule, getChatColor } from "@/lib/twitch/client";
import { fetchAndStoreStreamHistory } from "@/lib/twitch/fetchStreamHistory";

export type FriendCreateResult = "created" | "reactivated" | "confirmed" | "existing";

export async function createOrConfirmFriendFromTwitchUser(
  userId: string,
  twitchUser: TwitchUser,
  options: { isSuggested?: boolean } = {}
): Promise<{ friend: NonNullable<Awaited<ReturnType<typeof prisma.friend.findFirst>>>; result: FriendCreateResult }> {
  const existing = await prisma.friend.findFirst({ where: { userId, twitchId: twitchUser.id } });

  if (existing) {
    if (!existing.isActive) {
      const friend = await prisma.friend.update({
        where: { id: existing.id },
        data: { isActive: true, isSuggested: options.isSuggested ?? false },
      });
      return { friend, result: "reactivated" };
    }

    if (existing.isSuggested && options.isSuggested === false) {
      const friend = await prisma.friend.update({
        where: { id: existing.id },
        data: { isSuggested: false },
      });
      return { friend, result: "confirmed" };
    }

    return { friend: existing, result: "existing" };
  }

  const channelColor = await getChatColor(twitchUser.login);

  const friend = await prisma.friend.create({
    data: {
      userId,
      twitchId: twitchUser.id,
      username: twitchUser.login,
      displayName: twitchUser.display_name,
      avatarUrl: twitchUser.profile_image_url,
      channelColor,
      isSuggested: options.isSuggested ?? false,
    },
  });

  await Promise.allSettled([
    fetchAndStoreStreamHistory(friend.id, twitchUser.id, 100),
    getBroadcasterSchedule(twitchUser.id).then(async (schedule) => {
      if (schedule?.segments) {
        await prisma.scheduleSegment.createMany({
          data: schedule.segments
            .filter((s) => !s.canceled_until)
            .map((s) => ({
              friendId: friend.id,
              segmentId: s.id,
              title: s.title,
              startTime: new Date(s.start_time),
              endTime: new Date(s.end_time),
              gameName: s.category?.name ?? "",
              gameId: s.category?.id ?? "",
              isRecurring: s.is_recurring,
            })),
        });
      }
    }),
  ]);

  return { friend, result: "created" };
}
