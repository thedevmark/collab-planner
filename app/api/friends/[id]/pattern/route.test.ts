import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    profile: { findUnique: vi.fn() },
    friend: { findFirst: vi.fn() },
    streamHistory: { findMany: vi.fn() },
    scheduleSegment: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: vi.fn(),
  unauthorized: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
}));

import { GET } from "./route";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  profile: { findUnique: ReturnType<typeof vi.fn> };
  friend: { findFirst: ReturnType<typeof vi.fn> };
  streamHistory: { findMany: ReturnType<typeof vi.fn> };
  scheduleSegment: { findMany: ReturnType<typeof vi.fn> };
};
const mockGetAuthUser = getAuthUser as unknown as ReturnType<typeof vi.fn>;

function makeReq() {
  return new Request("https://example.com/api/friends/1/pattern");
}

describe("GET /api/friends/[id]/pattern", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when user is not signed in", async () => {
    mockGetAuthUser.mockResolvedValueOnce(null);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is not numeric", async () => {
    mockGetAuthUser.mockResolvedValueOnce({ id: "uid-1" });
    const res = await GET(makeReq(), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when friend belongs to a different user", async () => {
    mockGetAuthUser.mockResolvedValueOnce({ id: "uid-1" });
    mockPrisma.friend.findFirst.mockResolvedValueOnce(null);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(404);
  });

  it("returns pattern with timezone from Profile", async () => {
    mockGetAuthUser.mockResolvedValueOnce({ id: "uid-1" });
    mockPrisma.friend.findFirst.mockResolvedValueOnce({ id: 1, displayName: "Alice" });
    mockPrisma.profile.findUnique.mockResolvedValueOnce({ timezone: "America/New_York" });
    // Seed 5 sessions in January 2026 at 23:00 UTC on Sun/Mon/Wed so analyzePatterns goes "history" path
    const baseSunday = new Date("2026-01-04T23:00:00Z").getTime();
    const sessions = [0, 1, 3, 7, 8].map((daysOff) => ({
      startTime: new Date(baseSunday + daysOff * 86_400_000),
      endTime: new Date(baseSunday + daysOff * 86_400_000 + 4 * 3600_000),
      gameName: "Apex",
      durationSec: 4 * 3600,
    }));
    mockPrisma.streamHistory.findMany.mockResolvedValueOnce(sessions);
    mockPrisma.scheduleSegment.findMany.mockResolvedValueOnce([]);

    const res = await GET(makeReq(), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.summary.tz).toBe("America/New_York");
    expect(Array.isArray(body.summary.topDays)).toBe(true);
    expect(typeof body.summary.medianHour).toBe("number");
  });

  it("defaults timezone to UTC when Profile has none", async () => {
    mockGetAuthUser.mockResolvedValueOnce({ id: "uid-2" });
    mockPrisma.friend.findFirst.mockResolvedValueOnce({ id: 2, displayName: "Bob" });
    mockPrisma.profile.findUnique.mockResolvedValueOnce({ timezone: "" });
    mockPrisma.streamHistory.findMany.mockResolvedValueOnce([]);
    mockPrisma.scheduleSegment.findMany.mockResolvedValueOnce([]);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: "2" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary?.tz ?? "UTC").toBe("UTC");
  });
});
