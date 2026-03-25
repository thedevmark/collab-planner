import { NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  await prisma.profile.update({
    where: { id: user.id },
    data: {
      discordId: null,
      discordUsername: null,
      discordAccessToken: null,
      discordRefreshToken: null,
      discordTokenExpiry: null,
      discordGuildId: null,
      discordGuildName: null,
      discordChannelId: null,
      discordChannelName: null,
    },
  });

  return NextResponse.json({ success: true });
}
