import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { detectCollabSignals, summarizeCollabSignals } from "@/lib/twitch/detectCollabs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const friendId = parseInt(id);

    const friend = await prisma.friend.findFirst({ where: { id: friendId, userId: user.id } });
    if (!friend) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const signals = await prisma.collabSignal.findMany({
      where: { friendId },
      orderBy: [{ confidence: "desc" }, { detectedAt: "desc" }],
    });

    const summary = summarizeCollabSignals(friend.displayName, signals);
    return NextResponse.json({ signals, summary });
  } catch {
    return NextResponse.json({ error: "Failed to fetch collab signals" }, { status: 500 });
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const friendId = parseInt(id);

    const friend = await prisma.friend.findFirst({ where: { id: friendId, userId: user.id } });
    if (!friend) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const count = await detectCollabSignals(friendId);

    const signals = await prisma.collabSignal.findMany({
      where: { friendId },
      orderBy: [{ confidence: "desc" }, { detectedAt: "desc" }],
    });

    const summary = summarizeCollabSignals(friend.displayName, signals);
    return NextResponse.json({ detected: count, signals, summary });
  } catch {
    return NextResponse.json({ error: "Detection failed" }, { status: 500 });
  }
}
