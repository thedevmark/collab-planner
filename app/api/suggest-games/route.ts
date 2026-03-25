import { NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { getSuggestedGames } from "@/lib/scheduling/games";

/**
 * POST /api/suggest-games
 * Body: { friendIds: number[] }
 *
 * Returns games ranked by how many selected friends have played them,
 * then by total session count. Purely algorithmic — no AI.
 */
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { friendIds } = await req.json() as { friendIds: number[] };

    if (!Array.isArray(friendIds) || friendIds.length === 0) {
      return NextResponse.json({ error: "friendIds required" }, { status: 400 });
    }

    const games = await getSuggestedGames(friendIds, user.id);
    return NextResponse.json({ games });
  } catch (err) {
    console.error("suggest-games error:", err);
    return NextResponse.json({ error: "Failed to fetch game suggestions" }, { status: 500 });
  }
}
