import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "20");

    const logs = await prisma.messageLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { event: { select: { id: true, title: true } } },
    });
    return NextResponse.json(logs);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch message logs" }, { status: 500 });
  }
}
