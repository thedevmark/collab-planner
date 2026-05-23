import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

// Mock next/server's `after` so it doesn't require a real Next.js request scope.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((cb: () => unknown) => { void cb(); }),
  };
});

// Mock prisma and the Helix client BEFORE importing the route.
vi.mock("@/lib/db", () => ({
  prisma: {
    profile: { findUnique: vi.fn() },
    friend: { findFirst: vi.fn() },
    streamHistory: { findMany: vi.fn() },
    scheduleSegment: { findMany: vi.fn() },
    eventParticipant: { findMany: vi.fn() },
    extensionPredictionCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/twitch/client", () => ({
  getRecentBroadcasts: vi.fn(),
  getBroadcasterSchedule: vi.fn(),
  parseDuration: vi.fn(() => 10800),
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

const mockPrisma = prisma as unknown as {
  profile: { findUnique: ReturnType<typeof vi.fn> };
  extensionPredictionCache: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

function makeReq(channelId: string, token: string | null) {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return new Request(`https://example.com/api/extension/channel/${channelId}/panel`, {
    headers,
  });
}

describe("GET /api/extension/channel/[channelId]/panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 with no auth header", async () => {
    const req = makeReq("12345", null);
    const res = await GET(req, { params: Promise.resolve({ channelId: "12345" }) });
    expect(res.status).toBe(401);
  });

  it("returns 401 when JWT channel_id does not match URL", async () => {
    const token = await makeToken("12345");
    const req = makeReq("99999", token);
    const res = await GET(req, { params: Promise.resolve({ channelId: "99999" }) });
    expect(res.status).toBe(401);
  });

  it("returns warming on cold cache for unconnected channel and writes sentinel", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    mockPrisma.extensionPredictionCache.findUnique.mockResolvedValue(null);
    mockPrisma.extensionPredictionCache.upsert.mockResolvedValue({});

    const token = await makeToken("12345");
    const req = makeReq("12345", token);
    const res = await GET(req, { params: Promise.resolve({ channelId: "12345" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("warming");
    expect(mockPrisma.extensionPredictionCache.upsert).toHaveBeenCalledOnce();
  });

  it("returns cached payload for unconnected channel when fresh", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    mockPrisma.extensionPredictionCache.findUnique.mockResolvedValue({
      twitchId: "12345",
      payload: { status: "ok", predictions: [], collabs: [], generatedAt: "x" },
      computedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const token = await makeToken("12345");
    const req = makeReq("12345", token);
    const res = await GET(req, { params: Promise.resolve({ channelId: "12345" }) });
    const body = await res.json();

    expect(body.status).toBe("ok");
  });

  it("includes CORS header on response", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    mockPrisma.extensionPredictionCache.findUnique.mockResolvedValue(null);
    mockPrisma.extensionPredictionCache.upsert.mockResolvedValue({});
    const token = await makeToken("12345");
    const req = makeReq("12345", token);
    const res = await GET(req, { params: Promise.resolve({ channelId: "12345" }) });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("OPTIONS returns 204 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });
});
