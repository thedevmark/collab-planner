import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getUserByUsername, getChatColor } from "@/lib/twitch/client";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const meta = data.user.user_metadata;
      const userId = data.user.id;

      // Upsert profile from Twitch identity
      const twitchId: string = meta.provider_id ?? meta.sub ?? "";
      const username: string = meta.preferred_username ?? meta.user_name ?? "";
      const displayName: string = meta.full_name ?? meta.name ?? username;
      const avatarUrl: string = meta.avatar_url ?? meta.picture ?? "";

      await prisma.profile.upsert({
        where: { id: userId },
        create: { id: userId, twitchId, username, displayName, avatarUrl },
        update: { displayName, avatarUrl },
      });

      // Auto-create or update the "isMe" friend so own VODs get tracked
      const existingMe = await prisma.friend.findFirst({
        where: { userId, isMe: true },
      });

      if (!existingMe) {
        // Try to fetch channel color from Twitch
        let channelColor = "";
        try {
          channelColor = await getChatColor(username);
        } catch {
          // non-critical
        }

        await prisma.friend.create({
          data: {
            userId,
            twitchId,
            username,
            displayName,
            avatarUrl,
            channelColor,
            isMe: true,
            isActive: true,
          },
        });
      } else {
        // Keep avatar and display name in sync
        await prisma.friend.update({
          where: { id: existingMe.id },
          data: { displayName, avatarUrl },
        });
      }
    }
  }

  return NextResponse.redirect(new URL("/", origin));
}
