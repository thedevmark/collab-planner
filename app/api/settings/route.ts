import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { resolveWebhookMetadata } from "@/lib/discord/client";
import { z } from "zod";

const settingsSchema = z.object({
  timezone: z.string().optional(),
  notificationsEnabled: z.boolean().optional(),
  publicApiEnabled: z.boolean().optional(),
  discordGuildId: z.string().nullable().optional(),
  discordGuildName: z.string().nullable().optional(),
  discordChannelId: z.string().nullable().optional(),
  discordChannelName: z.string().nullable().optional(),
  discordWebhookUrl: z.string().nullable().optional(),
});

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    return NextResponse.json({
      twitchUsername: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      timezone: profile.timezone,
      publicApiEnabled: profile.publicApiEnabled,
      discordUsername: profile.discordUsername,
      discordGuildId: profile.discordGuildId,
      discordGuildName: profile.discordGuildName,
      discordChannelId: profile.discordChannelId,
      discordChannelName: profile.discordChannelName,
      discordWebhookUrl: profile.discordWebhookUrl,
    });
  } catch (err) {
    console.error("[api/settings] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const data = settingsSchema.parse(body);

    // When a webhook URL is saved, resolve it to the guild + channel it posts to
    // so scheduled-event creation knows which server to target. When it's cleared,
    // clear the derived fields too unless the caller explicitly set them.
    let resolvedGuildId: string | null | undefined;
    let resolvedChannelId: string | null | undefined;
    if (data.discordWebhookUrl !== undefined) {
      if (data.discordWebhookUrl) {
        const meta = await resolveWebhookMetadata(data.discordWebhookUrl);
        resolvedGuildId = meta?.guildId ?? null;
        resolvedChannelId = meta?.channelId ?? null;
      } else {
        resolvedGuildId = null;
        resolvedChannelId = null;
      }
    }

    const profile = await prisma.profile.update({
      where: { id: user.id },
      data: {
        ...(data.timezone && { timezone: data.timezone }),
        ...(data.publicApiEnabled !== undefined && { publicApiEnabled: data.publicApiEnabled }),
        ...(data.discordGuildId !== undefined && { discordGuildId: data.discordGuildId }),
        ...(data.discordGuildName !== undefined && { discordGuildName: data.discordGuildName }),
        ...(data.discordChannelId !== undefined && { discordChannelId: data.discordChannelId }),
        ...(data.discordChannelName !== undefined && { discordChannelName: data.discordChannelName }),
        ...(data.discordWebhookUrl !== undefined && { discordWebhookUrl: data.discordWebhookUrl }),
        // Auto-resolved IDs override any explicit values from the client for the
        // same request — the client shouldn't be guessing these.
        ...(resolvedGuildId !== undefined && { discordGuildId: resolvedGuildId }),
        ...(resolvedChannelId !== undefined && { discordChannelId: resolvedChannelId }),
      },
    });

    return NextResponse.json({
      twitchUsername: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      timezone: profile.timezone,
      publicApiEnabled: profile.publicApiEnabled,
      discordUsername: profile.discordUsername,
      discordGuildId: profile.discordGuildId,
      discordGuildName: profile.discordGuildName,
      discordChannelId: profile.discordChannelId,
      discordChannelName: profile.discordChannelName,
      discordWebhookUrl: profile.discordWebhookUrl,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.message }, { status: 400 });
    }
    console.error("[api/settings] PUT failed:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
