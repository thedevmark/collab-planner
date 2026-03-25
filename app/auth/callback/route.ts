import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getUserByUsername, getChatColor } from "@/lib/twitch/client";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.user) {
        const meta = data.user.user_metadata;
        const userId = data.user.id;

        const twitchId: string = meta.provider_id ?? meta.sub ?? "";
        const username: string = meta.preferred_username ?? meta.user_name ?? "";
        const displayName: string = meta.full_name ?? meta.name ?? username;
        const avatarUrl: string = meta.avatar_url ?? meta.picture ?? "";

        await prisma.profile.upsert({
          where: { id: userId },
          create: { id: userId, twitchId, username, displayName, avatarUrl },
          update: { displayName, avatarUrl },
          select: { id: true },
        });

        const existingMe = await prisma.friend.findFirst({
          where: { userId, isMe: true },
          select: { id: true },
        });

        if (!existingMe) {
          let channelColor = "";
          try {
            channelColor = await getChatColor(username);
          } catch {
            // non-critical
          }
          await prisma.friend.create({
            data: { userId, twitchId, username, displayName, avatarUrl, channelColor, isMe: true, isActive: true },
            select: { id: true },
          });
        } else {
          await prisma.friend.update({
            where: { id: existingMe.id },
            data: { displayName, avatarUrl },
            select: { id: true },
          });
        }
      }
    } catch (err) {
      console.error("[auth/callback] error:", err);
      // Still redirect to home — don't return 500 to the browser
    }
  }

  return NextResponse.redirect(new URL("/", origin));
}
