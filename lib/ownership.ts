import { prisma } from "@/lib/db";

export async function verifyFriendOwnership(friendId: number, userId: string) {
  return prisma.friend.findFirst({ where: { id: friendId, userId } });
}

export async function verifyEventOwnership(eventId: number, userId: string) {
  return prisma.event.findFirst({ where: { id: eventId, userId } });
}
