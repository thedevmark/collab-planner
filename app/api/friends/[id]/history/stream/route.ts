import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { fetchAndStoreStreamHistory } from "@/lib/twitch/fetchStreamHistory";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const friend = await prisma.friend.findFirst({ where: { id: parseInt(id), userId: user.id } });
    if (!friend) return NextResponse.json({ error: "Friend not found" }, { status: 404 });

    const history = await prisma.streamHistory.findMany({
      where: { friendId: parseInt(id) },
      orderBy: { startTime: "desc" },
      take: 100,
    });
    return NextResponse.json(history);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch stream history" }, { status: 500 });
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const friend = await prisma.friend.findFirst({ where: { id: parseInt(id), userId: user.id } });
    if (!friend) return NextResponse.json({ error: "Friend not found" }, { status: 404 });

    const count = await fetchAndStoreStreamHistory(friend.id, friend.twitchId, 100);
    return NextResponse.json({ message: "Stream history refreshed", count });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to refresh: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
