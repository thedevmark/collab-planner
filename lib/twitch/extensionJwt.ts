import { jwtVerify } from "jose";

export class ExtensionJwtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtensionJwtError";
  }
}

export interface ExtensionJwtClaims {
  channel_id: string;
  /** Only present when the viewer has clicked "Grant Permission" to
   *  share their Twitch identity with the extension. Anonymous viewers
   *  (the default for everyone visiting friend channels) have no
   *  user_id — use opaque_user_id instead for any per-viewer logic. */
  user_id: string | null;
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
  // Only channel_id and role are universally present. user_id is
  // optional — anonymous viewers (most Twitch viewers, who never click
  // "Grant Permission") legitimately have no user_id, only opaque_user_id.
  // Requiring it here was rejecting every anonymous viewer with a 401,
  // which is why friends couldn't see the panel.
  const userId = payload.user_id != null ? String(payload.user_id) : null;
  const role = String(payload.role ?? "");

  if (!channelId || !role) {
    throw new ExtensionJwtError("missing required claims (channel_id or role)");
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
