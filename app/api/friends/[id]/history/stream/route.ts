import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchAndStoreStreamHistory } from "@/lib/twitch/fetchStreamHistory";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const friend = await prisma.friend.findUnique({ where: { id: parseInt(id) } });
    if (!friend) return NextResponse.json({ error: "Friend not found" }, { status: 404 });

    const count = await fetchAndStoreStreamHistory(friend.id, friend.twitchId, 20);
    return NextResponse.json({ message: "Stream history refreshed", count });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to refresh: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const history = await prisma.streamHistory.findMany({
      where: { friendId: parseInt(id) },
      orderBy: { startTime: "desc" },
      take: 30,
    });
    return NextResponse.json(history);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch stream history" }, { status: 500 });
  }
}
