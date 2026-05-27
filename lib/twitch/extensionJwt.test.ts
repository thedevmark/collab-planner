import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { verifyExtensionJwt, ExtensionJwtError } from "./extensionJwt";

// A 64-byte fake secret, base64-encoded as Twitch issues it.
const RAW_SECRET = new Uint8Array(64).fill(7);
const BASE64_SECRET = Buffer.from(RAW_SECRET).toString("base64");

async function sign(payload: Record<string, unknown>, opts: { exp?: number } = {}) {
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? Math.floor(Date.now() / 1000) + 60);
  return jwt.sign(RAW_SECRET);
}

describe("verifyExtensionJwt", () => {
  it("returns decoded claims for a valid token", async () => {
    const token = await sign({
      channel_id: "12345",
      user_id: "opaque-abc",
      role: "viewer",
      pubsub_perms: { listen: [], send: [] },
    });
    const claims = await verifyExtensionJwt(token, BASE64_SECRET);
    expect(claims.channel_id).toBe("12345");
    expect(claims.role).toBe("viewer");
  });

  it("accepts an anonymous viewer JWT (no user_id, only opaque_user_id)", async () => {
    // Twitch only includes user_id when the viewer has explicitly granted
    // identity-sharing permission. Anonymous viewers (the default for
    // virtually every viewer on every channel) have only opaque_user_id.
    // Rejecting these JWTs is the bug that caused friends' panels to 401.
    const token = await sign({
      channel_id: "12345",
      opaque_user_id: "U-anon-xyz",
      role: "viewer",
    });
    const claims = await verifyExtensionJwt(token, BASE64_SECRET);
    expect(claims.channel_id).toBe("12345");
    expect(claims.user_id).toBeNull();
    expect(claims.opaque_user_id).toBe("U-anon-xyz");
    expect(claims.role).toBe("viewer");
  });

  it("rejects a token signed with the wrong secret", async () => {
    const wrong = Buffer.from(new Uint8Array(64).fill(9)).toString("base64");
    const token = await sign({ channel_id: "12345", user_id: "opaque", role: "viewer" });
    await expect(verifyExtensionJwt(token, wrong)).rejects.toThrow(ExtensionJwtError);
  });

  it("rejects an expired token", async () => {
    const token = await sign(
      { channel_id: "12345", user_id: "opaque", role: "viewer" },
      { exp: Math.floor(Date.now() / 1000) - 10 }
    );
    await expect(verifyExtensionJwt(token, BASE64_SECRET)).rejects.toThrow(ExtensionJwtError);
  });

  it("rejects a token whose channel_id mismatches the assertion", async () => {
    const token = await sign({ channel_id: "12345", user_id: "opaque", role: "viewer" });
    await expect(
      verifyExtensionJwt(token, BASE64_SECRET, { expectChannelId: "99999" })
    ).rejects.toThrow(/channel_id mismatch/);
  });
});
