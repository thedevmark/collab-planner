# Twitch Panel Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Twitch Panel Extension that surfaces a streamer's most-likely upcoming live times (computed by Collab Planner's VOD pattern analysis) plus their scheduled collabs, with every channel getting useful content even without a Collab Planner account.

**Architecture:** A new JWT-verified Next.js API route (`/api/extension/channel/[channelId]/panel`) serves predictions to a standalone React+Vite SPA built in a new `twitch-extension/` workspace. The SPA is uploaded as a zip to the Twitch Extension dashboard. Two tiers: cached predictions for CP users, on-demand Helix-derived predictions (with Postgres-backed sentinel debounce) for everyone else.

**Tech Stack:** Next.js 16, Prisma 7, TypeScript 5, React 19, Vite (extension SPA), vitest (tests, new dep), `jose` (JWT verify, new dep), Twitch Extension Helper SDK (CDN-loaded in the SPA).

**Spec:** `docs/superpowers/specs/2026-05-23-twitch-extension-design.md`

**Out of scope:** The existing `/api/extension/streamer/[username]` route is unrelated (different surface, no JWT) and is left untouched.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `vitest.config.ts` | Create | Vitest config (node env, includes lib/ + twitch-extension/src) |
| `prisma/schema.prisma` | Modify | Add `ExtensionPredictionCache` model |
| `lib/twitch/extensionJwt.ts` | Create | Verify Twitch-signed JWTs (HS256, base64-decoded secret) |
| `lib/twitch/extensionJwt.test.ts` | Create | Unit tests for JWT verify |
| `lib/twitch/extensionPredictions.ts` | Create | Build the panel JSON payload from DB lookups + scheduling lib |
| `lib/twitch/extensionPredictions.test.ts` | Create | Unit tests for payload shaping |
| `app/api/extension/channel/[channelId]/panel/route.ts` | Create | The single endpoint the extension hits |
| `app/api/extension/channel/[channelId]/panel/route.test.ts` | Create | Integration tests with mocked Prisma + JWT helpers |
| `.env.example` | Modify | Document `TWITCH_EXTENSION_SECRET`, `TWITCH_EXTENSION_CLIENT_ID` |
| `twitch-extension/package.json` | Create | Standalone workspace deps (react, vite, typescript) |
| `twitch-extension/vite.config.ts` | Create | Multi-entry build (panel + config), relative asset paths |
| `twitch-extension/tsconfig.json` | Create | Strict TS for the SPA |
| `twitch-extension/public/panel.html` | Create | Panel HTML shell — Twitch Helper script loaded first |
| `twitch-extension/public/config.html` | Create | Config HTML shell — Twitch Helper script loaded first |
| `twitch-extension/src/panel.tsx` | Create | Panel root component |
| `twitch-extension/src/config.tsx` | Create | Config root component |
| `twitch-extension/src/lib/twitchExt.ts` | Create | Wrapper around `window.Twitch.ext` |
| `twitch-extension/src/lib/api.ts` | Create | Fetch helper with JWT auth header |
| `twitch-extension/src/lib/format.ts` | Create | Viewer-local date/time formatters |
| `twitch-extension/src/lib/format.test.ts` | Create | Unit tests for format.ts |
| `twitch-extension/src/lib/types.ts` | Create | Shared response types (mirrors backend shape) |
| `twitch-extension/src/components/PredictionsList.tsx` | Create | Predictions list UI |
| `twitch-extension/src/components/CollabsList.tsx` | Create | Collabs section UI |
| `twitch-extension/src/components/PoweredByFooter.tsx` | Create | Footer link with `↗` |
| `twitch-extension/src/styles.css` | Create | Minimal styles, dark-on-twitch palette |
| `twitch-extension/README.md` | Create | Build + zip + submission instructions |
| `twitch-extension/.gitignore` | Create | Ignore dist/, node_modules/ |

---

## Phase 1 — Test infrastructure

### Task 1: Add vitest to the project root

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest + the JWT lib**

```bash
npm install --save-dev vitest @vitest/coverage-v8
npm install jose
```

Expected: both added to `package.json`.

- [ ] **Step 2: Add the test script to package.json**

In `package.json`, add to the `scripts` block:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "app/**/*.test.ts",
      "twitch-extension/src/**/*.test.ts",
    ],
    exclude: ["node_modules", ".next", "twitch-extension/node_modules"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

- [ ] **Step 4: Verify the runner boots**

Run: `npx vitest run --reporter=verbose`
Expected: "No test files found" (this is correct — no tests yet). Exit code 1 is OK; we just want to confirm vitest is discoverable.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add vitest + jose deps for extension work"
```

---

## Phase 2 — Backend

### Task 2: Add `ExtensionPredictionCache` Prisma model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Append the model**

Add after the `CollabInviteRecipient` model in `prisma/schema.prisma`:

```prisma
model ExtensionPredictionCache {
  twitchId    String   @id
  payload     Json?
  computedAt  DateTime @default(now())
  expiresAt   DateTime

  @@index([expiresAt])
}
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add_extension_prediction_cache
```

Expected: migration created, Prisma client regenerated. If the project uses `db push` instead of migrations, run `npx prisma db push` (the user's README references `migrate dev`, so prefer that).

- [ ] **Step 3: Verify the model is in the generated client**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "db: add ExtensionPredictionCache for Twitch ext panel"
```

---

### Task 3: Build `lib/twitch/extensionJwt.ts`

Verifies the JWT that Twitch's Extension Helper hands to the panel iframe. Twitch signs with HS256 using a base64-encoded shared secret from the extension dashboard.

**Files:**
- Create: `lib/twitch/extensionJwt.ts`
- Create: `lib/twitch/extensionJwt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/twitch/extensionJwt.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run lib/twitch/extensionJwt.test.ts
```

Expected: FAIL — cannot find module `./extensionJwt`.

- [ ] **Step 3: Write the implementation**

Create `lib/twitch/extensionJwt.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run lib/twitch/extensionJwt.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/twitch/extensionJwt.ts lib/twitch/extensionJwt.test.ts
git commit -m "feat(ext): verify Twitch extension JWTs"
```

---

### Task 4: Build `lib/twitch/extensionPredictions.ts`

Pure response shaper. Given a `twitchId`, returns the `PanelResponse` shape from the spec — connected tier uses `analyzePatterns()` on the profile's friend record, unconnected tier returns `{ status: "warming" }` (the route handles the cache row dance, not this module).

**Files:**
- Create: `lib/twitch/extensionPredictions.ts`
- Create: `lib/twitch/extensionPredictions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { shapeConnectedPanelResponse } from "./extensionPredictions";
import type { StreamingPattern } from "@/lib/scheduling/patterns";

const basePattern: StreamingPattern = {
  friendId: 1,
  displayName: "Streamer",
  typicalDays: ["Tuesday", "Thursday", "Saturday"],
  startHours: { earliest: 19, latest: 22, median: 20 },
  avgDurationHours: 3,
  topGames: ["Apex Legends"],
  confidence: "strong",
  summary: "",
  inferredWindows: [
    { start: new Date("2026-05-26T20:00:00Z"), end: new Date("2026-05-26T23:00:00Z") },
    { start: new Date("2026-05-28T20:00:00Z"), end: new Date("2026-05-28T23:00:00Z") },
    { start: new Date("2026-05-30T20:00:00Z"), end: new Date("2026-05-30T23:00:00Z") },
  ],
  dayFrequency: [0, 0, 1, 0, 1, 0, 1],
  hourDistribution: new Array(24).fill(0.3),
  consistency: 1,
  sampleSize: 25,
};

describe("shapeConnectedPanelResponse", () => {
  it("returns predictions sorted by start time with confidence stars", () => {
    const resp = shapeConnectedPanelResponse({
      pattern: basePattern,
      postedSchedule: [],
      upcomingCollabs: [],
    });

    expect(resp.status).toBe("ok");
    if (resp.status !== "ok") return;
    expect(resp.predictions).toHaveLength(3);
    expect(resp.predictions[0].startsAt).toBe("2026-05-26T20:00:00.000Z");
    expect(resp.predictions[0].confidence).toBe(3); // "strong" → 3
    expect(resp.predictions[0].isPosted).toBe(false);
  });

  it("marks slots as isPosted=true when posted schedule matches within 1h", () => {
    const resp = shapeConnectedPanelResponse({
      pattern: basePattern,
      postedSchedule: [
        { start: new Date("2026-05-26T20:30:00Z"), end: new Date("2026-05-26T23:30:00Z") },
      ],
      upcomingCollabs: [],
    });

    expect(resp.status).toBe("ok");
    if (resp.status !== "ok") return;
    expect(resp.predictions[0].isPosted).toBe(true);
    expect(resp.predictions[1].isPosted).toBe(false);
  });

  it("includes collabs in the response", () => {
    const resp = shapeConnectedPanelResponse({
      pattern: basePattern,
      postedSchedule: [],
      upcomingCollabs: [
        {
          startsAt: "2026-05-30T20:00:00.000Z",
          gameName: "Apex Legends",
          partners: [{ username: "alice", displayName: "Alice", avatarUrl: "" }],
        },
      ],
    });

    expect(resp.status).toBe("ok");
    if (resp.status !== "ok") return;
    expect(resp.collabs).toHaveLength(1);
    expect(resp.collabs[0].partners[0].username).toBe("alice");
  });

  it("returns no_data when sampleSize is 0 and no posted schedule", () => {
    const empty: StreamingPattern = { ...basePattern, sampleSize: 0, inferredWindows: [] };
    const resp = shapeConnectedPanelResponse({
      pattern: empty,
      postedSchedule: [],
      upcomingCollabs: [],
    });
    expect(resp.status).toBe("no_data");
  });

  it("maps confidence tiers correctly: estimated→1, weak/moderate→2, strong/schedule→3", () => {
    for (const [tier, expected] of [
      ["estimated", 1],
      ["weak", 2],
      ["moderate", 2],
      ["strong", 3],
      ["schedule", 3],
    ] as const) {
      const p = { ...basePattern, confidence: tier };
      const resp = shapeConnectedPanelResponse({
        pattern: p,
        postedSchedule: [],
        upcomingCollabs: [],
      });
      if (resp.status !== "ok") throw new Error("expected ok");
      expect(resp.predictions[0].confidence).toBe(expected);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run lib/twitch/extensionPredictions.test.ts
```

Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

Create `lib/twitch/extensionPredictions.ts`:

```ts
import type { StreamingPattern } from "@/lib/scheduling/patterns";

export type PanelResponse =
  | {
      status: "ok";
      predictions: Array<{
        day: string;
        startsAt: string;
        durationHours: number;
        confidence: 1 | 2 | 3;
        isPosted: boolean;
      }>;
      collabs: Array<{
        startsAt: string;
        gameName: string | null;
        partners: Array<{ username: string; displayName: string; avatarUrl: string }>;
      }>;
      generatedAt: string;
    }
  | { status: "warming" }
  | { status: "no_data" };

interface PostedSlot {
  start: Date;
  end: Date;
}

interface CollabInput {
  startsAt: string;
  gameName: string | null;
  partners: Array<{ username: string; displayName: string; avatarUrl: string }>;
}

interface Inputs {
  pattern: StreamingPattern;
  postedSchedule: PostedSlot[];
  upcomingCollabs: CollabInput[];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const POSTED_MATCH_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function confidenceTier(c: StreamingPattern["confidence"]): 1 | 2 | 3 {
  if (c === "estimated") return 1;
  if (c === "weak" || c === "moderate") return 2;
  return 3; // strong, schedule
}

export function shapeConnectedPanelResponse(inputs: Inputs): PanelResponse {
  const { pattern, postedSchedule, upcomingCollabs } = inputs;

  if (pattern.sampleSize === 0 && postedSchedule.length === 0) {
    return { status: "no_data" };
  }

  const confidence = confidenceTier(pattern.confidence);
  const durationHours = pattern.avgDurationHours;

  const predictions = pattern.inferredWindows
    .slice()
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 5)
    .map((w) => {
      const isPosted = postedSchedule.some(
        (p) => Math.abs(p.start.getTime() - w.start.getTime()) <= POSTED_MATCH_WINDOW_MS
      );
      return {
        day: DAY_NAMES[w.start.getUTCDay()],
        startsAt: w.start.toISOString(),
        durationHours,
        confidence,
        isPosted,
      };
    });

  return {
    status: "ok",
    predictions,
    collabs: upcomingCollabs,
    generatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run lib/twitch/extensionPredictions.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/twitch/extensionPredictions.ts lib/twitch/extensionPredictions.test.ts
git commit -m "feat(ext): shape panel response payload"
```

---

### Task 5: Build the panel API route

The endpoint pulls everything together. Two tiers handled here:
- **Connected** (CP profile exists by twitchId): build response from live DB queries + `analyzePatterns`.
- **Unconnected** (no CP profile): consult `ExtensionPredictionCache`. Hit → return. Miss → write a sentinel row, kick off background analysis, return `{ status: "warming" }`.

**Files:**
- Create: `app/api/extension/channel/[channelId]/panel/route.ts`
- Create: `app/api/extension/channel/[channelId]/panel/route.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run app/api/extension/channel
```

Expected: FAIL — route module not found.

- [ ] **Step 3: Write the route**

Create `app/api/extension/channel/[channelId]/panel/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyExtensionJwt, ExtensionJwtError } from "@/lib/twitch/extensionJwt";
import { shapeConnectedPanelResponse, type PanelResponse } from "@/lib/twitch/extensionPredictions";
import { analyzePatterns, type StreamSession, type ScheduleHint } from "@/lib/scheduling/patterns";
import { getRecentBroadcasts, getBroadcasterSchedule, parseDuration } from "@/lib/twitch/client";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const CONNECTED_TTL_SECONDS = 900; // 15 min
const UNCONNECTED_TTL_MS = 86_400_000; // 24h
const SENTINEL_TTL_MS = 60_000; // 60s — debounces concurrent cold analyses

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function json(body: PanelResponse | { error: string }, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init.headers ?? {}) },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return json({ error: "missing_token" }, { status: 401 });
  }

  const secret = process.env.TWITCH_EXTENSION_SECRET;
  if (!secret) {
    console.error("[ext/panel] TWITCH_EXTENSION_SECRET not set");
    return json({ error: "server_misconfigured" }, { status: 500 });
  }

  try {
    await verifyExtensionJwt(token, secret, { expectChannelId: channelId });
  } catch (err) {
    if (err instanceof ExtensionJwtError) {
      return json({ error: "invalid_token" }, { status: 401 });
    }
    throw err;
  }

  const profile = await prisma.profile.findUnique({
    where: { twitchId: channelId },
  });

  if (profile) {
    const payload = await buildConnectedPayload(profile.id, channelId);
    return json(payload, {
      headers: {
        "Cache-Control": `public, s-maxage=${CONNECTED_TTL_SECONDS}, stale-while-revalidate=60`,
      },
    });
  }

  return handleUnconnected(channelId);
}

async function buildConnectedPayload(userId: string, twitchId: string): Promise<PanelResponse> {
  const friend = await prisma.friend.findFirst({
    where: { userId, twitchId, isMe: true },
  });

  if (!friend) {
    return { status: "no_data" };
  }

  const [history, segments, eventParticipants] = await Promise.all([
    prisma.streamHistory.findMany({
      where: { friendId: friend.id },
      orderBy: { startTime: "desc" },
      take: 50,
    }),
    prisma.scheduleSegment.findMany({
      where: { friendId: friend.id, startTime: { gte: new Date() } },
      orderBy: { startTime: "asc" },
      take: 25,
    }),
    prisma.eventParticipant.findMany({
      where: {
        friendId: friend.id,
        event: { startTime: { gte: new Date() }, status: { in: ["planned", "confirmed"] } },
      },
      include: {
        event: {
          include: {
            participants: { include: { friend: true } },
          },
        },
      },
      orderBy: { event: { startTime: "asc" } },
      take: 5,
    }),
  ]);

  const sessions: StreamSession[] = history.map((s) => ({
    startTime: s.startTime,
    endTime: s.endTime,
    gameName: s.gameName,
    durationSec: s.durationSec,
  }));

  const hints: ScheduleHint[] = segments.map((s) => ({
    startTime: s.startTime,
    endTime: s.endTime,
    gameName: s.gameName,
    isRecurring: s.isRecurring,
  }));

  const pattern = analyzePatterns(friend.id, friend.displayName, sessions, hints);

  const collabs = eventParticipants.map((p) => ({
    startsAt: p.event.startTime.toISOString(),
    gameName: p.event.gameName || null,
    partners: p.event.participants
      .filter((pp) => pp.friendId !== friend.id)
      .map((pp) => ({
        username: pp.friend.username,
        displayName: pp.friend.displayName,
        avatarUrl: pp.friend.avatarUrl,
      })),
  }));

  return shapeConnectedPanelResponse({
    pattern,
    postedSchedule: segments.map((s) => ({ start: s.startTime, end: s.endTime })),
    upcomingCollabs: collabs,
  });
}

async function handleUnconnected(twitchId: string): Promise<NextResponse> {
  const now = new Date();

  const cached = await prisma.extensionPredictionCache.findUnique({
    where: { twitchId },
  });

  if (cached && cached.expiresAt > now) {
    if (cached.payload === null) {
      return json({ status: "warming" });
    }
    return json(cached.payload as PanelResponse, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=300" },
    });
  }

  // Write a sentinel and kick off the analysis without awaiting.
  await prisma.extensionPredictionCache.upsert({
    where: { twitchId },
    create: {
      twitchId,
      payload: null as never, // null sentinel
      computedAt: now,
      expiresAt: new Date(now.getTime() + SENTINEL_TTL_MS),
    },
    update: {
      payload: null as never,
      computedAt: now,
      expiresAt: new Date(now.getTime() + SENTINEL_TTL_MS),
    },
  });

  // Fire-and-forget. We deliberately do not await — the viewer gets "warming"
  // immediately and the next request (after ~5s retry) gets the cached payload.
  void computeAndCacheUnconnected(twitchId).catch((err) => {
    console.error(`[ext/panel] background analysis failed for ${twitchId}:`, err);
  });

  return json({ status: "warming" });
}

async function computeAndCacheUnconnected(twitchId: string): Promise<void> {
  const [videos, schedule] = await Promise.all([
    getRecentBroadcasts(twitchId, 30),
    getBroadcasterSchedule(twitchId).catch(() => null),
  ]);

  const sessions: StreamSession[] = videos.map((v) => {
    const start = new Date(v.created_at);
    const durationSec = parseDuration(v.duration);
    return {
      startTime: start,
      endTime: new Date(start.getTime() + durationSec * 1000),
      gameName: "",
      durationSec,
    };
  });

  const hints: ScheduleHint[] = (schedule?.segments ?? []).map((seg) => ({
    startTime: new Date(seg.start_time),
    endTime: new Date(seg.end_time),
    gameName: seg.category?.name ?? "",
    isRecurring: seg.is_recurring ?? false,
  }));

  const pattern = analyzePatterns(0, twitchId, sessions, hints);

  const payload = shapeConnectedPanelResponse({
    pattern,
    postedSchedule: hints.map((h) => ({ start: h.startTime, end: h.endTime })),
    upcomingCollabs: [],
  });

  const now = new Date();
  await prisma.extensionPredictionCache.update({
    where: { twitchId },
    data: {
      payload: payload as never,
      computedAt: now,
      expiresAt: new Date(now.getTime() + UNCONNECTED_TTL_MS),
    },
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run app/api/extension/channel
```

Expected: all 6 tests pass.

- [ ] **Step 5: Update `.env.example`**

Append:

```
# Twitch Extension (Panel)
TWITCH_EXTENSION_SECRET=
TWITCH_EXTENSION_CLIENT_ID=
```

- [ ] **Step 6: Commit**

```bash
git add app/api/extension/channel .env.example
git commit -m "feat(ext): panel API route with JWT verify + warming cache"
```

---

## Phase 3 — SPA scaffolding

### Task 6: Scaffold the `twitch-extension/` workspace

**Files:**
- Create: `twitch-extension/package.json`
- Create: `twitch-extension/tsconfig.json`
- Create: `twitch-extension/vite.config.ts`
- Create: `twitch-extension/.gitignore`

- [ ] **Step 1: Create the workspace folder and package.json**

Create `twitch-extension/package.json`:

```json
{
  "name": "collab-planner-twitch-extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "package": "node scripts/zip.mjs"
  },
  "dependencies": {
    "react": "19.2.3",
    "react-dom": "19.2.3"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "^5",
    "vite": "^7.0.0"
  }
}
```

- [ ] **Step 2: Install workspace deps**

```bash
cd twitch-extension
npm install
cd ..
```

Expected: `twitch-extension/node_modules` created.

- [ ] **Step 3: Create `twitch-extension/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `twitch-extension/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./", // Twitch hosts the zip on its CDN; all asset paths must be relative.
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, "public/panel.html"),
        config: resolve(__dirname, "public/config.html"),
      },
    },
    minify: false, // Twitch requires human-readable JS at submission.
  },
});
```

- [ ] **Step 5: Create `twitch-extension/.gitignore`**

```
node_modules/
dist/
*.zip
```

- [ ] **Step 6: Verify the dev server boots (smoke)**

```bash
cd twitch-extension && npx vite --version && cd ..
```

Expected: vite version printed.

- [ ] **Step 7: Commit**

```bash
git add twitch-extension/package.json twitch-extension/package-lock.json twitch-extension/tsconfig.json twitch-extension/vite.config.ts twitch-extension/.gitignore
git commit -m "feat(ext): scaffold twitch-extension vite workspace"
```

---

### Task 7: Add panel and config HTML shells

Twitch requires the Extension Helper script to be the **first** `<script>` in each HTML file.

**Files:**
- Create: `twitch-extension/public/panel.html`
- Create: `twitch-extension/public/config.html`

- [ ] **Step 1: Create `twitch-extension/public/panel.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Collab Planner — Panel</title>
    <script src="https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js"></script>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/panel.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `twitch-extension/public/config.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Collab Planner — Config</title>
    <script src="https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js"></script>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/config.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add twitch-extension/public
git commit -m "feat(ext): panel + config HTML shells with Twitch Helper"
```

---

### Task 8: Build the Twitch SDK wrapper

**Files:**
- Create: `twitch-extension/src/lib/twitchExt.ts`

- [ ] **Step 1: Create the wrapper**

```ts
// Minimal typed wrapper around window.Twitch.ext. Only exposes what we use.

export interface TwitchAuth {
  channelId: string;
  clientId: string;
  token: string;
  userId: string;
}

interface TwitchExtGlobal {
  onAuthorized: (cb: (auth: TwitchAuth) => void) => void;
  onContext?: (cb: (ctx: Record<string, unknown>) => void) => void;
  configuration?: {
    broadcaster?: { content?: string; version?: string };
    onChanged?: (cb: () => void) => void;
  };
}

declare global {
  interface Window {
    Twitch?: { ext?: TwitchExtGlobal };
  }
}

/** Resolve once the Twitch Helper hands us a JWT. */
export function awaitAuthorized(timeoutMs = 10_000): Promise<TwitchAuth> {
  return new Promise((resolve, reject) => {
    const ext = window.Twitch?.ext;
    if (!ext) {
      reject(new Error("Twitch Extension Helper not loaded"));
      return;
    }
    const timer = setTimeout(() => reject(new Error("onAuthorized timeout")), timeoutMs);
    ext.onAuthorized((auth) => {
      clearTimeout(timer);
      resolve(auth);
    });
  });
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd twitch-extension && npx tsc --noEmit && cd ..
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add twitch-extension/src/lib/twitchExt.ts
git commit -m "feat(ext): typed Twitch Helper wrapper"
```

---

### Task 9: Build the API fetch helper

**Files:**
- Create: `twitch-extension/src/lib/api.ts`
- Create: `twitch-extension/src/lib/types.ts`

- [ ] **Step 1: Create the shared types**

```ts
// twitch-extension/src/lib/types.ts
// Mirror of lib/twitch/extensionPredictions.ts PanelResponse.

export type PanelResponse =
  | {
      status: "ok";
      predictions: Array<{
        day: string;
        startsAt: string;
        durationHours: number;
        confidence: 1 | 2 | 3;
        isPosted: boolean;
      }>;
      collabs: Array<{
        startsAt: string;
        gameName: string | null;
        partners: Array<{ username: string; displayName: string; avatarUrl: string }>;
      }>;
      generatedAt: string;
    }
  | { status: "warming" }
  | { status: "no_data" };
```

- [ ] **Step 2: Create the API helper**

```ts
// twitch-extension/src/lib/api.ts
import type { PanelResponse } from "./types";

const API_BASE = "https://collab.deutschmark.online";

export async function fetchPanel(channelId: string, token: string): Promise<PanelResponse> {
  const res = await fetch(`${API_BASE}/api/extension/channel/${channelId}/panel`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`panel fetch failed: ${res.status}`);
  }
  return (await res.json()) as PanelResponse;
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd twitch-extension && npx tsc --noEmit && cd ..
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add twitch-extension/src/lib/api.ts twitch-extension/src/lib/types.ts
git commit -m "feat(ext): API client + shared types"
```

---

### Task 10: Build the date/time formatter

Pure functions, TDD'd against the root vitest config (which already includes `twitch-extension/src/**/*.test.ts`).

**Files:**
- Create: `twitch-extension/src/lib/format.ts`
- Create: `twitch-extension/src/lib/format.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { formatSlot } from "./format";

describe("formatSlot", () => {
  it("formats a UTC start time in the given timezone as 'Day h:mm a'", () => {
    // 2026-05-26T20:00:00Z is Tuesday 4:00pm America/New_York (EDT, UTC-4)
    const result = formatSlot("2026-05-26T20:00:00.000Z", {
      locale: "en-US",
      timeZone: "America/New_York",
    });
    expect(result.day).toBe("Tue");
    expect(result.time).toBe("4:00 PM");
  });

  it("respects the locale string for day labels", () => {
    const result = formatSlot("2026-05-26T20:00:00.000Z", {
      locale: "de-DE",
      timeZone: "Europe/Berlin",
    });
    // In de-DE, narrow weekday Tuesday is "Di"
    expect(result.day).toBe("Di");
  });

  it("handles a UTC timezone", () => {
    const result = formatSlot("2026-05-26T20:00:00.000Z", {
      locale: "en-US",
      timeZone: "UTC",
    });
    expect(result.day).toBe("Tue");
    expect(result.time).toBe("8:00 PM");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run twitch-extension/src/lib/format.test.ts
```

Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```ts
// twitch-extension/src/lib/format.ts

export interface FormatOptions {
  locale: string;
  timeZone: string;
}

export interface FormattedSlot {
  day: string;
  time: string;
}

export function formatSlot(startsAt: string, opts: FormatOptions): FormattedSlot {
  const d = new Date(startsAt);
  const dayFmt = new Intl.DateTimeFormat(opts.locale, {
    weekday: "short",
    timeZone: opts.timeZone,
  });
  const timeFmt = new Intl.DateTimeFormat(opts.locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: opts.timeZone,
  });
  return {
    day: dayFmt.format(d),
    time: timeFmt.format(d),
  };
}

export function resolveViewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function resolveViewerLocale(twitchLocale: string | undefined): string {
  if (twitchLocale) return twitchLocale;
  if (typeof navigator !== "undefined" && navigator.language) return navigator.language;
  return "en-US";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run twitch-extension/src/lib/format.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add twitch-extension/src/lib/format.ts twitch-extension/src/lib/format.test.ts
git commit -m "feat(ext): viewer-local time/day formatters"
```

---

## Phase 4 — SPA components

### Task 11: Build `PredictionsList.tsx`

**Files:**
- Create: `twitch-extension/src/components/PredictionsList.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { PanelResponse } from "../lib/types";
import { formatSlot, type FormatOptions } from "../lib/format";

type Predictions = Extract<PanelResponse, { status: "ok" }>["predictions"];

interface Props {
  predictions: Predictions;
  format: FormatOptions;
}

function Stars({ filled }: { filled: 1 | 2 | 3 }) {
  return (
    <span className="stars" aria-label={`confidence ${filled} of 3`}>
      {"★".repeat(filled)}
      <span className="stars-dim">{"★".repeat(3 - filled)}</span>
    </span>
  );
}

export function PredictionsList({ predictions, format }: Props) {
  if (predictions.length === 0) {
    return <p className="empty">No recent broadcast data to analyze yet.</p>;
  }
  return (
    <ul className="predictions">
      {predictions.map((p) => {
        const slot = formatSlot(p.startsAt, format);
        return (
          <li key={p.startsAt} className="prediction">
            <span className="day">{slot.day}</span>
            <span className="time">{slot.time}</span>
            <span className="dur">~{p.durationHours}h</span>
            <span className="meta">
              {p.isPosted ? <span className="badge">Scheduled</span> : <Stars filled={p.confidence} />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd twitch-extension && npx tsc --noEmit && cd ..
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add twitch-extension/src/components/PredictionsList.tsx
git commit -m "feat(ext): predictions list component"
```

---

### Task 12: Build `CollabsList.tsx`

**Files:**
- Create: `twitch-extension/src/components/CollabsList.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { PanelResponse } from "../lib/types";
import { formatSlot, type FormatOptions } from "../lib/format";

type Collabs = Extract<PanelResponse, { status: "ok" }>["collabs"];

interface Props {
  collabs: Collabs;
  format: FormatOptions;
}

export function CollabsList({ collabs, format }: Props) {
  if (collabs.length === 0) return null;
  return (
    <section className="collabs">
      <h2>Upcoming collabs</h2>
      <ul>
        {collabs.map((c) => {
          const slot = formatSlot(c.startsAt, format);
          const names = c.partners.map((p) => `@${p.username}`).join(" ");
          return (
            <li key={c.startsAt} className="collab">
              <div>
                <span className="day">{slot.day}</span> <span className="time">{slot.time}</span>
              </div>
              <div className="partners">with {names}</div>
              {c.gameName && <div className="game">{c.gameName}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd twitch-extension && npx tsc --noEmit && cd ..
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add twitch-extension/src/components/CollabsList.tsx
git commit -m "feat(ext): collabs list component"
```

---

### Task 13: Build `PoweredByFooter.tsx`

**Files:**
- Create: `twitch-extension/src/components/PoweredByFooter.tsx`

- [ ] **Step 1: Create the component**

```tsx
interface Props {
  campaign: string; // "panel_footer" | "panel_empty" | "config_view"
}

export function PoweredByFooter({ campaign }: Props) {
  const href = `https://collab.deutschmark.online/?utm_source=twitch_ext&utm_medium=panel&utm_campaign=${campaign}`;
  return (
    <footer className="powered-by">
      <a href={href} target="_blank" rel="noopener noreferrer">
        Powered by Collab Planner <span aria-hidden="true">↗</span>
      </a>
    </footer>
  );
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd twitch-extension && npx tsc --noEmit && cd ..
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add twitch-extension/src/components/PoweredByFooter.tsx
git commit -m "feat(ext): powered-by footer with off-site indicator"
```

---

### Task 14: Wire `panel.tsx` (root)

**Files:**
- Create: `twitch-extension/src/panel.tsx`
- Create: `twitch-extension/src/styles.css`

- [ ] **Step 1: Create styles.css**

```css
:root {
  color-scheme: dark;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 14px;
}
body {
  margin: 0;
  background: #18181b;
  color: #efeff1;
}
#root {
  padding: 12px;
}
h1 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px;
}
h2 {
  font-size: 12px;
  font-weight: 600;
  margin: 16px 0 4px;
  color: #adadb8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.predictions, .collabs ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.prediction {
  display: grid;
  grid-template-columns: 32px 1fr auto auto;
  gap: 8px;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #2a2a2e;
}
.prediction:last-child { border-bottom: none; }
.day { color: #adadb8; font-weight: 600; }
.dur { color: #adadb8; font-size: 12px; }
.stars { color: #9147ff; }
.stars-dim { color: #3a3a3d; }
.badge {
  background: #00c8af;
  color: #0e0e10;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  text-transform: uppercase;
}
.collab {
  padding: 6px 0;
  border-bottom: 1px solid #2a2a2e;
}
.collab:last-child { border-bottom: none; }
.partners { font-size: 12px; color: #adadb8; }
.game { font-size: 12px; color: #efeff1; margin-top: 2px; }
.powered-by {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #2a2a2e;
  text-align: center;
  font-size: 11px;
}
.powered-by a {
  color: #9147ff;
  text-decoration: none;
}
.powered-by a:hover { text-decoration: underline; }
.empty, .loading, .error {
  color: #adadb8;
  font-size: 13px;
  text-align: center;
  padding: 24px 0;
}
```

- [ ] **Step 2: Create `panel.tsx`**

```tsx
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { awaitAuthorized, type TwitchAuth } from "./lib/twitchExt";
import { fetchPanel } from "./lib/api";
import type { PanelResponse } from "./lib/types";
import { resolveViewerLocale, resolveViewerTimeZone, type FormatOptions } from "./lib/format";
import { PredictionsList } from "./components/PredictionsList";
import { CollabsList } from "./components/CollabsList";
import { PoweredByFooter } from "./components/PoweredByFooter";

const WARMING_RETRY_MS = 5_000;

function Panel() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; data: Extract<PanelResponse, { status: "ok" }>; fmt: FormatOptions }
    | { kind: "warming"; fmt: FormatOptions }
    | { kind: "no_data"; fmt: FormatOptions }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(auth: TwitchAuth, fmt: FormatOptions) {
      try {
        const data = await fetchPanel(auth.channelId, auth.token);
        if (cancelled) return;
        if (data.status === "ok") setState({ kind: "ok", data, fmt });
        else if (data.status === "warming") {
          setState({ kind: "warming", fmt });
          timer = setTimeout(() => load(auth, fmt), WARMING_RETRY_MS);
        } else setState({ kind: "no_data", fmt });
      } catch (err) {
        if (!cancelled) {
          setState({ kind: "error", message: err instanceof Error ? err.message : "unknown" });
        }
      }
    }

    awaitAuthorized()
      .then((auth) => {
        const fmt: FormatOptions = {
          locale: resolveViewerLocale(undefined),
          timeZone: resolveViewerTimeZone(),
        };
        return load(auth, fmt);
      })
      .catch((err) =>
        setState({ kind: "error", message: err instanceof Error ? err.message : "unknown" })
      );

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (state.kind === "loading") return <p className="loading">Loading…</p>;
  if (state.kind === "warming") return <p className="loading">Analyzing recent broadcasts…</p>;
  if (state.kind === "error") return <p className="error">Unable to load panel.</p>;
  if (state.kind === "no_data")
    return (
      <>
        <h1>Likely upcoming streams</h1>
        <p className="empty">No recent broadcast data to analyze yet.</p>
        <PoweredByFooter campaign="panel_empty" />
      </>
    );

  return (
    <>
      <h1>Likely upcoming streams</h1>
      <PredictionsList predictions={state.data.predictions} format={state.fmt} />
      <CollabsList collabs={state.data.collabs} format={state.fmt} />
      <PoweredByFooter campaign="panel_footer" />
    </>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Panel />
    </StrictMode>
  );
}
```

- [ ] **Step 3: Build verifies**

```bash
cd twitch-extension && npm run build && cd ..
```

Expected: `dist/panel.html` and `dist/config.html` produced (config will fail until Task 15 — if so, comment out the config entry in vite.config.ts temporarily, OR skip this step until Task 15).

To avoid the chicken-and-egg, create a stub `twitch-extension/src/config.tsx` first with just this content:

```tsx
export {};
```

Then run the build:

```bash
cd twitch-extension && npm run build && cd ..
```

- [ ] **Step 4: Commit**

```bash
git add twitch-extension/src/panel.tsx twitch-extension/src/styles.css twitch-extension/src/config.tsx
git commit -m "feat(ext): panel root + styles"
```

---

### Task 15: Build `config.tsx` (broadcaster status view)

The config view shows one of three states. Since the extension auto-links by Twitch ID, we re-use the same panel endpoint to detect the state — if it returns `no_data` or 404 (no profile), we show the sign-in pitch; otherwise we show the connected pitch.

**Files:**
- Modify: `twitch-extension/src/config.tsx`

- [ ] **Step 1: Replace stub with the real config view**

```tsx
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { awaitAuthorized } from "./lib/twitchExt";
import { fetchPanel } from "./lib/api";
import type { PanelResponse } from "./lib/types";

type State =
  | { kind: "loading" }
  | { kind: "connected"; predictions: number; collabs: number }
  | { kind: "warming" }
  | { kind: "no_data" }
  | { kind: "not_in_cp" }
  | { kind: "error"; message: string };

const DASHBOARD = "https://collab.deutschmark.online";
const SIGN_IN = `${DASHBOARD}/?utm_source=twitch_ext&utm_medium=config_view&utm_campaign=not_in_cp`;
const OPEN_DASH = `${DASHBOARD}/?utm_source=twitch_ext&utm_medium=config_view&utm_campaign=connected`;

function Config() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    awaitAuthorized()
      .then(async (auth) => {
        try {
          const data: PanelResponse = await fetchPanel(auth.channelId, auth.token);
          if (data.status === "ok") {
            setState({
              kind: "connected",
              predictions: data.predictions.length,
              collabs: data.collabs.length,
            });
          } else if (data.status === "warming") {
            setState({ kind: "warming" });
          } else {
            setState({ kind: "no_data" });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "unknown";
          if (msg.includes("404")) setState({ kind: "not_in_cp" });
          else setState({ kind: "error", message: msg });
        }
      })
      .catch((err) =>
        setState({ kind: "error", message: err instanceof Error ? err.message : "unknown" })
      );
  }, []);

  if (state.kind === "loading") return <p className="loading">Loading…</p>;
  if (state.kind === "error") return <p className="error">Unable to load config.</p>;

  if (state.kind === "not_in_cp" || state.kind === "no_data") {
    return (
      <>
        <h1>Collab Planner</h1>
        <p>
          Your channel isn't connected yet. Sign in with Twitch at Collab Planner — your panel
          will start working automatically.
        </p>
        <p>
          <a className="cta" href={SIGN_IN} target="_blank" rel="noopener noreferrer">
            Sign in with Twitch ↗
          </a>
        </p>
      </>
    );
  }

  if (state.kind === "warming") {
    return (
      <>
        <h1>Collab Planner ✓</h1>
        <p>Account detected. Analyzing your recent broadcasts — panel will populate within a few minutes.</p>
      </>
    );
  }

  return (
    <>
      <h1>Collab Planner ✓</h1>
      <p>
        Account detected. {state.predictions} predicted slot{state.predictions === 1 ? "" : "s"},{" "}
        {state.collabs} upcoming collab{state.collabs === 1 ? "" : "s"}.
      </p>
      <p>
        <a className="cta" href={OPEN_DASH} target="_blank" rel="noopener noreferrer">
          Open dashboard ↗
        </a>
      </p>
    </>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Config />
    </StrictMode>
  );
}
```

- [ ] **Step 2: Add `.cta` style**

Append to `twitch-extension/src/styles.css`:

```css
.cta {
  display: inline-block;
  background: #9147ff;
  color: white;
  padding: 8px 14px;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 600;
}
.cta:hover { background: #7a3fd9; }
```

- [ ] **Step 3: Build verifies both entries**

```bash
cd twitch-extension && npm run build && cd ..
```

Expected: `dist/panel.html` and `dist/config.html` both present with their JS bundles.

- [ ] **Step 4: Commit**

```bash
git add twitch-extension/src/config.tsx twitch-extension/src/styles.css
git commit -m "feat(ext): broadcaster config view with state-aware CTAs"
```

---

## Phase 5 — Package & document

### Task 16: Add a `package` script that zips `dist/`

Twitch wants a zip uploaded via the dashboard. Adding a one-liner script avoids hand-zipping mistakes (no extra parent folder inside the zip).

**Files:**
- Create: `twitch-extension/scripts/zip.mjs`

- [ ] **Step 1: Create the script**

```js
// twitch-extension/scripts/zip.mjs
// Zip the dist/ folder into collab-planner-ext-<version>.zip.
// Zero deps: uses the OS `zip` (mac/linux) or PowerShell Compress-Archive (Windows).

import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const distDir = path.join(root, "dist");

if (!existsSync(distDir)) {
  console.error("dist/ does not exist. Run `npm run build` first.");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const outName = `collab-planner-ext-${pkg.version}.zip`;
const outPath = path.join(root, outName);

if (existsSync(outPath)) rmSync(outPath);

const isWindows = process.platform === "win32";
if (isWindows) {
  execSync(`powershell -Command "Compress-Archive -Path '${distDir}/*' -DestinationPath '${outPath}'"`, {
    stdio: "inherit",
  });
} else {
  execSync(`cd "${distDir}" && zip -r "${outPath}" .`, { stdio: "inherit", shell: "/bin/bash" });
}

console.log(`\nWrote ${outName}`);
```

- [ ] **Step 2: Run the package step**

```bash
cd twitch-extension && npm run build && npm run package && cd ..
```

Expected: `twitch-extension/collab-planner-ext-0.1.0.zip` exists. Inspect with `unzip -l twitch-extension/collab-planner-ext-0.1.0.zip` (or PowerShell) — should show `panel.html`, `config.html`, and the `assets/` folder at the top level (no nested `dist/`).

- [ ] **Step 3: Commit**

```bash
git add twitch-extension/scripts/zip.mjs
git commit -m "feat(ext): npm run package zips dist/ for Twitch upload"
```

---

### Task 17: Write `twitch-extension/README.md`

**Files:**
- Create: `twitch-extension/README.md`

- [ ] **Step 1: Create the README**

```markdown
# Collab Planner — Twitch Panel Extension

Static SPA shipped to the Twitch Extension dashboard. Talks to the main Collab
Planner backend at `collab.deutschmark.online` for prediction data.

## Local development

```bash
npm install
npm run dev        # serves panel.html / config.html via vite dev server
```

Open `http://localhost:5173/public/panel.html` to preview. The Twitch Helper
script won't authorize outside the Twitch Developer Rig, so JWT-dependent code
will hang at "Loading…" — that's expected.

For full end-to-end testing, use the [Twitch Developer Rig](https://dev.twitch.tv/docs/extensions/rig/).

## Build + package

```bash
npm run build      # → dist/
npm run package    # → collab-planner-ext-<version>.zip
```

Upload the zip in the [Twitch Extension dashboard](https://dev.twitch.tv/console/extensions)
under "Files".

## Submission checklist

When submitting a new version for review:

1. **Test channel must be live during review.** Use a CP-connected test account
   that is actively broadcasting at submission time.
2. **Hosted Test → ensure the panel loads and renders a predictions list within
   5 seconds.** Confirm the footer link opens `collab.deutschmark.online` in a
   new tab.
3. **Declared URLs:** in the Asset Hosting form, list only:
   - `https://collab.deutschmark.online/api/extension/channel/*` (fetch)
   - `https://collab.deutschmark.online/` (link)
4. **Description copy:**
   > Surfaces this streamer's most likely upcoming live times based on broadcast
   > history, plus any scheduled collabs they've planned.
5. **Required env on the backend:**
   - `TWITCH_EXTENSION_SECRET` (base64, from the extension dashboard)
   - `TWITCH_EXTENSION_CLIENT_ID`

## Architecture

- `src/panel.tsx` — viewer-facing panel iframe entry.
- `src/config.tsx` — broadcaster-facing config iframe entry.
- `src/lib/twitchExt.ts` — typed wrapper around `window.Twitch.ext`.
- `src/lib/api.ts` — fetch wrapper that hits the CP backend with the Twitch JWT.
- `src/lib/format.ts` — viewer-local date/time formatting (Intl-based).

The backend endpoint and JWT verification live in the main Next.js app at:
- `app/api/extension/channel/[channelId]/panel/route.ts`
- `lib/twitch/extensionJwt.ts`
- `lib/twitch/extensionPredictions.ts`

See `docs/superpowers/specs/2026-05-23-twitch-extension-design.md` for the design.
```

- [ ] **Step 2: Commit**

```bash
git add twitch-extension/README.md
git commit -m "docs(ext): submission + dev README"
```

---

## Phase 6 — Final verification

### Task 18: Full test + build sweep

- [ ] **Step 1: Run all backend tests**

```bash
npx vitest run
```

Expected: all tests pass (Tasks 3, 4, 5, 10 contributed tests — should see ~18 passing).

- [ ] **Step 2: Type-check the main app**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Type-check the extension SPA**

```bash
cd twitch-extension && npx tsc --noEmit && cd ..
```

Expected: no errors.

- [ ] **Step 4: Build the Next.js app**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Build + package the extension**

```bash
cd twitch-extension && npm run build && npm run package && cd ..
```

Expected: zip produced under `twitch-extension/`.

- [ ] **Step 6: No commit — verification only.**

---

## Self-review notes (already addressed inline)

- **Spec coverage:** every section of the spec maps to a task — JWT verify (Task 3), payload shaping (Task 4), endpoint with warming cache (Task 5), Prisma model (Task 2), SPA scaffolding (Task 6), HTML shells with Helper first (Task 7), SDK wrapper (Task 8), API client (Task 9), formatters (Task 10), components (11–13), panel/config roots (14–15), packaging + docs (16–17).
- **Type consistency:** `PanelResponse` is defined once in `lib/twitch/extensionPredictions.ts` and mirrored in `twitch-extension/src/lib/types.ts` — both kept identical by hand (acceptable since they're in separate workspaces).
- **Cold-cache mechanism:** Task 5 uses the Postgres-sentinel approach from the spec, not a fragile in-memory map.
- **CTA compliance:** Task 13 footer is a single `Powered by ↗` link; the broadcaster-only config (Task 15) carries the more direct sign-in CTA. Matches the spec's policy reconciliation.
- **Deployment:** the backend route ships with the next Next.js deploy; the extension zip is uploaded manually via the dashboard — both are documented in `twitch-extension/README.md`.

## Out of scope (do not implement here)

- Setting reminders
- Friends-of-the-channel grid
- Viewer write actions
- Video component or overlay surfaces
- Mobile surface
- Identity-share viewer experience
- Anything touching the existing `/api/extension/streamer/[username]` route
