import { NextResponse } from "next/server";
import { getTopGames } from "@/lib/twitch/client";

export const revalidate = 3600; // cache for 1 hour

export async function GET() {
  try {
    const games = await getTopGames(10);
    return NextResponse.json({ games });
  } catch {
    return NextResponse.json({ games: [] }, { status: 200 });
  }
}
