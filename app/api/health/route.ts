import { prisma } from "@/lib/db";
import { publicApiJson, publicApiPreflight } from "@/lib/publicApiCors";

export async function OPTIONS(req: Request) {
  return publicApiPreflight(req);
}

export async function GET(req: Request) {
  const dbUrl = process.env.DATABASE_URL;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return publicApiJson(req, { status: "ok", db: "connected", urlSet: !!dbUrl });
  } catch (err) {
    console.error("[api/health] GET failed:", err);
    return publicApiJson(
      req,
      { status: "error", error: String(err), urlSet: !!dbUrl },
      500,
    );
  }
}
