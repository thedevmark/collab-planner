import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/db", () => ({
  prisma: {
    profile: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/twitch/client", () => ({
  getChatColor: vi.fn(),
  getUserById: vi.fn(),
}));

const RAW_SECRET = new Uint8Array(64).fill(7);
const BASE64_SECRET = Buffer.from(RAW_SECRET).toString("base64");
process.env.TWITCH_EXTENSION_SECRET = BASE64_SECRET;

async function makeToken(channelId: string) {
  return new SignJWT({ channel_id: channelId, user_id: "opaque-x", role: "viewer" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
    .sign(RAW_SECRET);
}

import { GET, OPTIONS } from "./route";
import { prisma } from "@/lib/db";
import { getChatColor, getUserById } from "@/lib/twitch/client";

const mockPrisma = prisma as unknown as {
  profile: { findUnique: ReturnType<typeof vi.fn> };
};
const mockGetChatColor = getChatColor as unknown as ReturnType<typeof vi.fn>;
const mockGetUserById = getUserById as unknown as ReturnType<typeof vi.fn>;

function makeReq(channelId: string, token: string | null) {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return new Request(`https://example.com/api/extension/channel/${channelId}/twitch-color`, { headers });
}

describe("GET /api/extension/channel/[channelId]/twitch-color", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when JWT is missing", async () => {
    const res = await GET(makeReq("60131662", null), { params: Promise.resolve({ channelId: "60131662" }) });
    expect(res.status).toBe(401);
  });

  it("returns 401 when JWT channel_id does not match URL", async () => {
    const token = await makeToken("12345");
    const res = await GET(makeReq("99999", token), { params: Promise.resolve({ channelId: "99999" }) });
    expect(res.status).toBe(401);
  });

  it("returns the broadcaster color for a CP user (Profile.username path)", async () => {
    mockPrisma.profile.findUnique.mockResolvedValueOnce({ username: "thedeutschmark" });
    mockGetChatColor.mockResolvedValueOnce("#FF6600");
    const token = await makeToken("60131662");
    const res = await GET(makeReq("60131662", token), { params: Promise.resolve({ channelId: "60131662" }) });
    const body = await res.json();
    expect(body.color).toBe("#FF6600");
    expect(mockGetUserById).not.toHaveBeenCalled();
  });

  it("returns the broadcaster color for a non-CP user (Helix path)", async () => {
    mockPrisma.profile.findUnique.mockResolvedValueOnce(null);
    mockGetUserById.mockResolvedValueOnce({ id: "99999999", login: "somestreamer", display_name: "SomeStreamer" });
    mockGetChatColor.mockResolvedValueOnce("#00AAFF");
    const token = await makeToken("99999999");
    const res = await GET(makeReq("99999999", token), { params: Promise.resolve({ channelId: "99999999" }) });
    const body = await res.json();
    expect(body.color).toBe("#00AAFF");
    expect(mockGetUserById).toHaveBeenCalledWith("99999999");
  });

  it("returns null color when Twitch has none set", async () => {
    mockPrisma.profile.findUnique.mockResolvedValueOnce({ username: "thedeutschmark" });
    mockGetChatColor.mockResolvedValueOnce("");
    const token = await makeToken("60131662");
    const res = await GET(makeReq("60131662", token), { params: Promise.resolve({ channelId: "60131662" }) });
    const body = await res.json();
    expect(body.color).toBeNull();
  });

  it("returns null when login cannot be resolved", async () => {
    mockPrisma.profile.findUnique.mockResolvedValueOnce(null);
    mockGetUserById.mockResolvedValueOnce(null);
    const token = await makeToken("99999999");
    const res = await GET(makeReq("99999999", token), { params: Promise.resolve({ channelId: "99999999" }) });
    const body = await res.json();
    expect(body.color).toBeNull();
  });
});
