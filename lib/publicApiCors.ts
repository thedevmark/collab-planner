import { NextResponse } from "next/server";

/**
 * Trusted origins that are allowed to read the public collab API from a
 * browser. Non-browser callers (curl, OBS browser source, Streamer.bot) are
 * unaffected since they don't enforce CORS.
 */
const ALLOWED_ORIGINS = new Set([
  "https://toolkit.deutschmark.online",
  "https://deutschmark.online",
  "http://localhost:3000",
  "http://localhost:3001",
]);

export function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin",
    };
  }
  // Wildcard for anonymous browser callers (OBS widgets, personal dashboards).
  // This is safe because every public endpoint is read-only, opt-in, and
  // scoped to a single twitch login supplied in the query string.
  return {
    "Access-Control-Allow-Origin": "*",
  };
}

export function publicApiPreflight(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(req.headers.get("origin")),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export function publicApiJson<T>(
  req: Request,
  body: T,
  status = 200,
  extraHeaders: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), ...extraHeaders },
  });
}
