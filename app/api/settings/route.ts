import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { z } from "zod";

const settingsSchema = z.object({
  timezone: z.string().optional(),
  notificationsEnabled: z.boolean().optional(),
});

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    return NextResponse.json({
      twitchUsername: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      timezone: profile.timezone,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const data = settingsSchema.parse(body);

    const profile = await prisma.profile.update({
      where: { id: user.id },
      data: {
        ...(data.timezone && { timezone: data.timezone }),
      },
    });

    return NextResponse.json({
      twitchUsername: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      timezone: profile.timezone,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
