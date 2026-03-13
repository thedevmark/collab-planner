import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserByUsername, getChatColor } from "@/lib/twitch/client";
import { fetchAndStoreStreamHistory } from "@/lib/twitch/fetchStreamHistory";
import { clearApiKeyCache } from "@/lib/apiKeys";
import { z } from "zod";

const settingsSchema = z.object({
  twitchUsername: z.string().optional(),
  broadcasterId: z.string().optional(),
  twitchClientId: z.string().optional(),
  twitchClientSecret: z.string().optional(),
  geminiApiKey: z.string().optional(),
  timezone: z.string().optional(),
  refreshInterval: z.number().int().min(60).max(1440).optional(),
  notificationsEnabled: z.boolean().optional(),
});

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 6) return "••••••";
  return "••••••••" + key.slice(-4);
}

async function getOrCreateSettings() {
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({ data: {} });
  }
  return settings;
}

export async function GET() {
  try {
    const settings = await getOrCreateSettings();

    // Never return raw API keys to the frontend
    return NextResponse.json({
      id: settings.id,
      twitchUsername: settings.twitchUsername,
      broadcasterId: settings.broadcasterId,
      timezone: settings.timezone,
      refreshInterval: settings.refreshInterval,
      notificationsEnabled: settings.notificationsEnabled,
      twitchClientId: maskKey(settings.twitchClientId),
      twitchClientSecret: maskKey(settings.twitchClientSecret),
      geminiApiKey: maskKey(settings.geminiApiKey),
      hasTwitchKeys: !!(settings.twitchClientId && settings.twitchClientSecret),
      hasGeminiKey: !!settings.geminiApiKey,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const data = settingsSchema.parse(body);

    // Don't overwrite keys with masked values from the frontend
    const updateData: Record<string, any> = {};
    if (data.twitchUsername !== undefined) updateData.twitchUsername = data.twitchUsername;
    if (data.broadcasterId !== undefined) updateData.broadcasterId = data.broadcasterId;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.refreshInterval !== undefined) updateData.refreshInterval = data.refreshInterval;
    if (data.notificationsEnabled !== undefined) updateData.notificationsEnabled = data.notificationsEnabled;

    // Only update keys if they look like real values (not masked)
    if (data.twitchClientId && !data.twitchClientId.startsWith("••")) {
      updateData.twitchClientId = data.twitchClientId;
    }
    if (data.twitchClientSecret && !data.twitchClientSecret.startsWith("••")) {
      updateData.twitchClientSecret = data.twitchClientSecret;
    }
    if (data.geminiApiKey && !data.geminiApiKey.startsWith("••")) {
      updateData.geminiApiKey = data.geminiApiKey;
    }

    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({ data: updateData });
    } else {
      settings = await prisma.settings.update({ where: { id: settings.id }, data: updateData });
    }

    // Clear cached API keys so new values take effect immediately
    if (data.twitchClientId || data.twitchClientSecret || data.geminiApiKey) {
      clearApiKeyCache();
    }

    // Upsert "me" friend whenever twitchUsername changes
    if (data.twitchUsername) {
      try {
        const twitchUser = await getUserByUsername(data.twitchUsername);
        if (twitchUser) {
          const channelColor = await getChatColor(twitchUser.id);
          const me = await prisma.friend.upsert({
            where: { twitchId: twitchUser.id },
            create: {
              twitchId: twitchUser.id,
              username: twitchUser.login,
              displayName: twitchUser.display_name,
              avatarUrl: twitchUser.profile_image_url,
              channelColor,
              isMe: true,
            },
            update: {
              displayName: twitchUser.display_name,
              avatarUrl: twitchUser.profile_image_url,
              channelColor,
              isMe: true,
              isActive: true,
            },
          });
          fetchAndStoreStreamHistory(me.id, twitchUser.id, 30).catch(() => {});
        }
      } catch {
        // Don't fail the save if Twitch lookup fails
      }
    }

    // Return masked version
    return NextResponse.json({
      id: settings.id,
      twitchUsername: settings.twitchUsername,
      twitchClientId: maskKey(settings.twitchClientId),
      twitchClientSecret: maskKey(settings.twitchClientSecret),
      geminiApiKey: maskKey(settings.geminiApiKey),
      hasTwitchKeys: !!(settings.twitchClientId && settings.twitchClientSecret),
      hasGeminiKey: !!settings.geminiApiKey,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
