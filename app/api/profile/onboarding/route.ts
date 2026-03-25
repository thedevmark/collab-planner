import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const [profile, friendCount] = await Promise.all([
    prisma.profile.findUnique({ where: { id: user.id } }),
    prisma.friend.count({ where: { userId: user.id, isMe: false, isActive: true } }),
  ]);

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({
    hasCompletedOnboarding: profile.hasCompletedOnboarding,
    friendCount,
    timezone: profile.timezone,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const { timezone } = body as { timezone: string };

  if (!timezone || typeof timezone !== "string") {
    return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  }

  const updated = await prisma.profile.update({
    where: { id: user.id },
    data: { hasCompletedOnboarding: true, timezone },
  });

  return NextResponse.json({
    hasCompletedOnboarding: updated.hasCompletedOnboarding,
    timezone: updated.timezone,
    displayName: updated.displayName,
    avatarUrl: updated.avatarUrl,
  });
}

export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const updated = await prisma.profile.update({
    where: { id: user.id },
    data: { hasCompletedOnboarding: false },
  });

  return NextResponse.json({
    hasCompletedOnboarding: updated.hasCompletedOnboarding,
    timezone: updated.timezone,
    displayName: updated.displayName,
    avatarUrl: updated.avatarUrl,
  });
}
