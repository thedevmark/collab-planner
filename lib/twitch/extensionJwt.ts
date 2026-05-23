import { jwtVerify } from "jose";

export class ExtensionJwtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtensionJwtError";
  }
}

export interface ExtensionJwtClaims {
  channel_id: string;
  user_id: string;
  role: "broadcaster" | "moderator" | "viewer" | "external";
  exp: number;
  iat?: number;
  opaque_user_id?: string;
  pubsub_perms?: { listen?: string[]; send?: string[] };
}

interface VerifyOpts {
  expectChannelId?: string;
}

/**
 * Verify a Twitch Extension JWT. The secret as provided by the Twitch
 * dashboard is base64-encoded — we decode it here before passing to jose.
 */
export async function verifyExtensionJwt(
  token: string,
  base64Secret: string,
  opts: VerifyOpts = {}
): Promise<ExtensionJwtClaims> {
  let secret: Uint8Array;
  try {
    secret = new Uint8Array(Buffer.from(base64Secret, "base64"));
  } catch {
    throw new ExtensionJwtError("invalid base64 secret");
  }

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    throw new ExtensionJwtError(
      `jwt verify failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const channelId = String(payload.channel_id ?? "");
  const userId = String(payload.user_id ?? "");
  const role = String(payload.role ?? "");

  if (!channelId || !userId || !role) {
    throw new ExtensionJwtError("missing required claims");
  }

  if (opts.expectChannelId && opts.expectChannelId !== channelId) {
    throw new ExtensionJwtError(
      `channel_id mismatch: token=${channelId} expected=${opts.expectChannelId}`
    );
  }

  return {
    channel_id: channelId,
    user_id: userId,
    role: role as ExtensionJwtClaims["role"],
    exp: Number(payload.exp ?? 0),
    iat: payload.iat ? Number(payload.iat) : undefined,
    opaque_user_id: payload.opaque_user_id ? String(payload.opaque_user_id) : undefined,
    pubsub_perms: payload.pubsub_perms as ExtensionJwtClaims["pubsub_perms"],
  };
}
