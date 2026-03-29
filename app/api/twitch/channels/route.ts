import { NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { searchChannels } from "@/lib/twitch/client";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") ?? "";
    if (!query) return NextResponse.json([]);

    const channels = await searchChannels(query);
    return NextResponse.json(channels);
  } catch (err) {
    return NextResponse.json(
      { error: `Twitch API error: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
