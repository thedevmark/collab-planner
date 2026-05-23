import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    profile: { findFirst: vi.fn() },
    friend: { findFirst: vi.fn() },
    scheduleSegment: { findMany: vi.fn() },
    event: { findMany: vi.fn() },
  },
}));

import { GET, OPTIONS } from "./route";
import { prisma } from "@/lib/db";

const mockPrisma = prisma as unknown as {
  profile: { findFirst: ReturnType<typeof vi.fn> };
  friend: { findFirst: ReturnType<typeof vi.fn> };
  scheduleSegment: { findMany: ReturnType<typeof vi.fn> };
  event: { findMany: ReturnType<typeof vi.fn> };
};

function makeReq(query: string) {
  return new Request(`https://example.com/api/public/schedule?${query}`);
}

const OPTED_IN_PROFILE = {
  id: "user-1",
  username: "kindafunny",
  displayName: "KindaFunny",
  timezone: "America/Los_Angeles",
  avatarUrl: "https://static-cdn.jtvnw.net/kf.png",
  publicApiEnabled: true,
};

describe("GET /api/public/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400 when user param is missing", async () => {
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_user");
  });

  it("404 when profile does not exist", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("user=ghost"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("not_found");
  });

  it("404 when profile exists but publicApiEnabled is false (no fingerprinting)", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue({ ...OPTED_IN_PROFILE, publicApiEnabled: false });
    const res = await GET(makeReq("user=kindafunny"));
    expect(res.status).toBe(404);
  });

  it("200 with empty upcoming when opted in but no data", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue(OPTED_IN_PROFILE);
    mockPrisma.friend.findFirst.mockResolvedValue(null); // no isMe friend
    mockPrisma.event.findMany.mockResolvedValue([]);

    const res = await GET(makeReq("user=kindafunny"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.upcoming).toEqual([]);
    expect(body.login).toBe("kindafunny");
    expect(body.displayName).toBe("KindaFunny");
    expect(body.timezone).toBe("America/Los_Angeles");
    expect(body.profileImageUrl).toBe("https://static-cdn.jtvnw.net/kf.png");
    expect(body.lastUpdatedIso).toBeNull();
  });

  it("200 with merged segments + events sorted by startsAt, limited", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue(OPTED_IN_PROFILE);
    mockPrisma.friend.findFirst.mockResolvedValue({ id: 42 });
    mockPrisma.scheduleSegment.findMany.mockResolvedValue([
      {
        title: "Roguelike Tuesday",
        startTime: new Date("2026-05-26T02:00:00Z"),
        endTime: new Date("2026-05-26T05:00:00Z"),
        gameName: "Hades II",
        isRecurring: true,
        fetchedAt: new Date("2026-05-25T12:00:00Z"),
      },
      {
        title: "Late Friday",
        startTime: new Date("2026-05-30T03:00:00Z"),
        endTime: new Date("2026-05-30T06:00:00Z"),
        gameName: "",
        isRecurring: false,
        fetchedAt: new Date("2026-05-25T12:00:00Z"),
      },
    ]);
    mockPrisma.event.findMany.mockResolvedValue([
      {
        title: "Collab w/ @dangerdork",
        startTime: new Date("2026-05-28T01:00:00Z"),
        endTime: new Date("2026-05-28T04:00:00Z"),
        gameName: "Helldivers 2",
      },
    ]);

    const res = await GET(makeReq("user=kindafunny&limit=2"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.upcoming).toHaveLength(2);
    expect(body.upcoming[0].title).toBe("Roguelike Tuesday");
    expect(body.upcoming[0].source).toBe("twitch_schedule");
    expect(body.upcoming[0].isRecurring).toBe(true);
    expect(body.upcoming[0].category).toBe("Hades II");
    expect(body.upcoming[1].title).toBe("Collab w/ @dangerdork");
    expect(body.upcoming[1].source).toBe("collab_planner_event");
    expect(body.upcoming[1].isRecurring).toBe(false);
    expect(body.lastUpdatedIso).toBe("2026-05-25T12:00:00.000Z");
  });

  it("clamps days and limit to safe ranges", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue(OPTED_IN_PROFILE);
    mockPrisma.friend.findFirst.mockResolvedValue({ id: 42 });
    mockPrisma.scheduleSegment.findMany.mockResolvedValue([]);
    mockPrisma.event.findMany.mockResolvedValue([]);

    // days=999, limit=999 should both be clamped
    await GET(makeReq("user=kindafunny&days=999&limit=999"));

    const segCall = mockPrisma.scheduleSegment.findMany.mock.calls[0][0];
    const windowEnd = segCall.where.startTime.lte as Date;
    const now = segCall.where.startTime.gte as Date;
    const diffDays = (windowEnd.getTime() - now.getTime()) / 86_400_000;
    expect(diffDays).toBe(30); // clamped to 30

    expect(segCall.take).toBe(50); // limit clamped to 25, overfetch ×2
  });

  it("returns CORS Access-Control-Allow-Origin", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue(OPTED_IN_PROFILE);
    mockPrisma.friend.findFirst.mockResolvedValue(null);
    mockPrisma.event.findMany.mockResolvedValue([]);

    const res = await GET(makeReq("user=kindafunny"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
  });

  it("returns Cache-Control on 200 responses", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue(OPTED_IN_PROFILE);
    mockPrisma.friend.findFirst.mockResolvedValue(null);
    mockPrisma.event.findMany.mockResolvedValue([]);

    const res = await GET(makeReq("user=kindafunny"));
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });

  it("OPTIONS returns 204 with CORS headers", async () => {
    const res = await OPTIONS(makeReq(""));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
