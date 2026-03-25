import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await prisma.collabInvite.findUnique({ where: { token } });

  if (!invite) {
    return NextResponse.json({ valid: false, expired: false, exhausted: false, invite: null });
  }

  const now = new Date();
  const expired = invite.expiresAt != null && invite.expiresAt < now;
  const exhausted = invite.maxUses != null && invite.usedCount >= invite.maxUses;

  return NextResponse.json({ valid: true, expired, exhausted, invite });
}

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    await prisma.collabInvite.update({
      where: { token },
      data: { usedCount: { increment: 1 } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
