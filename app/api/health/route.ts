import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "connected", urlSet: !!dbUrl });
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: String(err), urlSet: !!dbUrl },
      { status: 500 }
    );
  }
}
