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
  getRecentBroadcasts: vi.fn().mockResolvedValue([]),
  getBroadcasterSchedule: vi.fn().mockResolvedValue(null),
  getUserById: vi.fn().mockResolvedValue(null),
  getStreamByUserId: vi.fn().mockResolvedValue(null),
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
import { getRecentBroadcasts } from "@/lib/twitch/client";

const mockPrisma = prisma as unknown as {
  profile: { findUnique: ReturnType<typeof vi.fn> };
  friend: { findFirst: ReturnType<typeof vi.fn> };
  streamHistory: { findMany: ReturnType<typeof vi.fn> };
  scheduleSegment: { findMany: ReturnType<typeof vi.fn> };
  eventParticipant: { findMany: ReturnType<typeof vi.fn> };
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
    // First call is the sentinel write that gates concurrent cold computes.
    // The `after()` callback fires a second upsert with the real payload —
    // both are expected; we only care that the sentinel was written.
    expect(mockPrisma.extensionPredictionCache.upsert).toHaveBeenCalled();
    expect(mockPrisma.extensionPredictionCache.upsert.mock.calls[0][0].create.payload)
      .toEqual(expect.objectContaining({}));
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

// ---------------------------------------------------------------------------
// Helpers for timezone tests: seed a fully connected profile so GET takes the
// buildConnectedPayload path, which threads tz into analyzePatterns.
// ---------------------------------------------------------------------------

const BASE_NOW = new Date("2026-01-04T12:00:00Z");

function makeConnectedSeed() {
  // profile
  mockPrisma.profile.findUnique.mockResolvedValue({ id: "uid-1", twitchId: "12345" });

  // friend (isMe: true)
  mockPrisma.friend.findFirst.mockResolvedValue({
    id: 1,
    userId: "uid-1",
    twitchId: "12345",
    isMe: true,
    displayName: "TestStreamer",
    username: "teststreamer",
    avatarUrl: "",
  });

  // 5 stream history rows so analyzePatterns takes the "history" branch (>=3)
  const sessions = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    friendId: 1,
    startTime: new Date(BASE_NOW.getTime() - i * 7 * 86_400_000),
    endTime: new Date(BASE_NOW.getTime() - i * 7 * 86_400_000 + 4 * 3_600_000),
    gameName: "Apex Legends",
    durationSec: 14_400,
  }));
  mockPrisma.streamHistory.findMany.mockResolvedValue(sessions);

  // Helix VOD lookup for "last live" freshness — default to empty (use DB row)
  (getRecentBroadcasts as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

  // no schedule segments
  mockPrisma.scheduleSegment.findMany.mockResolvedValue([]);

  // no events
  mockPrisma.eventParticipant.findMany.mockResolvedValue([]);
}

describe("panel route timezone handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the tz query param into the response", async () => {
    makeConnectedSeed();
    const token = await makeToken("12345");
    const req = new Request(
      "http://localhost/api/extension/channel/12345/panel?tz=America/New_York",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ channelId: "12345" }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.summary.tz).toBe("America/New_York");
  });

  it("falls back to UTC when tz is missing", async () => {
    makeConnectedSeed();
    const token = await makeToken("12345");
    const req = new Request(
      "http://localhost/api/extension/channel/12345/panel",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ channelId: "12345" }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary.tz).toBe("UTC");
  });

  it("falls back to UTC when tz is invalid", async () => {
    makeConnectedSeed();
    const token = await makeToken("12345");
    const req = new Request(
      "http://localhost/api/extension/channel/12345/panel?tz=Not/A/Real/Zone",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ channelId: "12345" }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary.tz).toBe("UTC");
  });
});
