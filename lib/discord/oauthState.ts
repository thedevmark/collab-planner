import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const DISCORD_OAUTH_STATE_COOKIE = "discord_oauth_state";
const DISCORD_OAUTH_STATE_TTL_SECONDS = 10 * 60;

function getDiscordOAuthCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function issueDiscordOAuthState() {
  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();

  cookieStore.set(
    DISCORD_OAUTH_STATE_COOKIE,
    state,
    getDiscordOAuthCookieOptions(DISCORD_OAUTH_STATE_TTL_SECONDS),
  );

  return state;
}

export function hasValidDiscordOAuthState(req: NextRequest, returnedState: string | null) {
  const expectedState = req.cookies.get(DISCORD_OAUTH_STATE_COOKIE)?.value ?? null;

  if (!expectedState || !returnedState) {
    return false;
  }

  const expected = Buffer.from(expectedState);
  const actual = Buffer.from(returnedState);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export function clearDiscordOAuthState(response: NextResponse) {
  response.cookies.set(
    DISCORD_OAUTH_STATE_COOKIE,
    "",
    getDiscordOAuthCookieOptions(0),
  );
}
