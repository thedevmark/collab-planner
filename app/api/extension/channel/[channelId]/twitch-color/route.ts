import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyExtensionJwt, ExtensionJwtError } from "@/lib/twitch/extensionJwt";
import { getChatColor, getUserById } from "@/lib/twitch/client";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function json(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init.headers ?? {}) },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "missing_token" }, { status: 401 });

  const secret = process.env.TWITCH_EXTENSION_SECRET;
  if (!secret) return json({ error: "server_misconfigured" }, { status: 500 });

  try {
    await verifyExtensionJwt(token, secret, { expectChannelId: channelId });
  } catch (err) {
    if (err instanceof ExtensionJwtError) return json({ error: "invalid_token" }, { status: 401 });
    throw err;
  }

  let login: string | null = null;
  const profile = await prisma.profile.findUnique({
    where: { twitchId: channelId },
    select: { username: true },
  });
  if (profile?.username) {
    login = profile.username;
  } else {
    try {
      const user = await getUserById(channelId);
      login = user?.login ?? null;
    } catch {
      // Helix failure — return null color
    }
  }

  if (!login) return json({ color: null });

  const hex = await getChatColor(login);
  return json({ color: hex || null }, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
