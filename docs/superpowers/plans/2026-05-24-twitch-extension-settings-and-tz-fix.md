# Twitch Extension Settings + Timezone Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a broadcaster-controllable settings page to the Twitch extension (timezone, show/hide collabs, show/hide game, accent color, custom CTA) and fix the panel-summary algorithm so days/hours are computed in the broadcaster's timezone instead of UTC.

**Architecture:** Settings persist in Twitch's Extension Configuration Service (no Postgres dependency, works for non-CP broadcasters). The SPA reads config client-side and applies presentation toggles. The broadcaster's timezone is passed as a `?tz=` query param to the panel API, which threads it through a refactored `analyzePatterns` that bins in broadcaster-local time and weights only stream-start hours/days (not every live hour). The duplicate client-side `getStreamingPattern` in the friend detail page is deleted and replaced with a call to a new shared `/api/friends/[id]/pattern` endpoint.

**Tech Stack:** Next.js 15 (app router), Prisma + Postgres (Supabase), Vite + React 19 (extension SPA, separate npm workspace), Vitest 4, Twitch Extensions Helper v1, Twitch Helix API.

**Spec:** `docs/superpowers/specs/2026-05-24-twitch-extension-settings-and-tz-fix-design.md`

---

## File Map

**Created:**
- `lib/twitch/extensionConfigSchema.ts` — backend copy of the broadcaster config schema + `parseConfig`.
- `lib/twitch/extensionConfigSchema.test.ts` — parser unit tests.
- `twitch-extension/src/lib/configSchema.ts` — SPA copy of the same schema (byte-identical body).
- `lib/twitch/__tests__/configSchemaIdentity.test.ts` — asserts the two schema files have identical body.
- `app/api/extension/channel/[channelId]/twitch-color/route.ts` — JWT-protected endpoint returning the broadcaster's Twitch chat color.
- `app/api/friends/[id]/pattern/route.ts` — server-side endpoint that returns the streaming pattern for a friend; replaces the client-side algorithm.
- `twitch-extension/src/components/SettingsForm.tsx` — the broadcaster-facing settings form.
- `twitch-extension/src/lib/contrast.ts` — `pickTextColor(hex)` helper for accent-color text contrast.

**Modified:**
- `lib/scheduling/patterns.ts` — `analyzePatterns` accepts `timezone`, switches to TZ-aware binning, weights only start hour/day.
- `lib/scheduling/patterns.test.ts` — new TZ-sensitivity tests.
- `lib/twitch/extensionPredictions.ts` — response schema renames `medianHourUtc` → `medianHour`, adds `tz`.
- `lib/twitch/extensionPredictions.test.ts` — updated to new schema.
- `app/api/extension/channel/[channelId]/panel/route.ts` — reads `?tz=`, validates, passes to algorithm.
- `app/api/extension/channel/[channelId]/panel/route.test.ts` — tests the `?tz=` propagation.
- `app/friends/[id]/page.tsx` — deletes local `getStreamingPattern`, calls new endpoint.
- `twitch-extension/src/config.tsx` — adds `<SettingsForm />` under the status strip.
- `twitch-extension/src/panel.tsx` — reads broadcaster config, applies toggles + accent + cta, passes `tz` to backend.
- `twitch-extension/src/lib/api.ts` — adds `tz` query param.
- `twitch-extension/src/lib/types.ts` — response schema rename + `tz` field.
- `twitch-extension/src/lib/twitchExt.ts` — adds `awaitConfiguration()` helper.
- `twitch-extension/src/components/ScheduleSummary.tsx` — renders `medianHour` formatted in `tz`.
- `twitch-extension/src/styles.css` — adds `--accent` CSS custom property + uses it.
- `twitch-extension/package.json` — bumps version `0.1.0` → `0.2.0`.
- `twitch-extension/manifest.json` — bumps version if version is tracked there.

**Manual Twitch dev console changes (Task 15):**
- Capabilities → Configuration method → "Extension Configuration Service".
- Asset Hosting → version `0.2.0`.

---

## Phase 1 — Shared config schema

### Task 1: Create the backend config schema + parser

**Files:**
- Create: `lib/twitch/extensionConfigSchema.ts`
- Test: `lib/twitch/extensionConfigSchema.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/twitch/extensionConfigSchema.test.ts
import { describe, it, expect } from "vitest";
import { parseConfig, DEFAULT_CONFIG, serializeConfig, type ExtConfigV1 } from "./extensionConfigSchema";

describe("parseConfig", () => {
  it("returns defaults for null / undefined / empty string", () => {
    expect(parseConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(parseConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(parseConfig("")).toEqual(DEFAULT_CONFIG);
  });

  it("returns defaults for malformed JSON", () => {
    expect(parseConfig("{not json")).toEqual(DEFAULT_CONFIG);
  });

  it("returns defaults when version is missing or wrong", () => {
    expect(parseConfig(JSON.stringify({ tz: "America/New_York" }))).toEqual(DEFAULT_CONFIG);
    expect(parseConfig(JSON.stringify({ v: 2, tz: "America/New_York" }))).toEqual(DEFAULT_CONFIG);
  });

  it("round-trips a full valid config", () => {
    const cfg: ExtConfigV1 = {
      v: 1,
      tz: "America/New_York",
      showCollabs: false,
      showGame: false,
      accentColor: "#FF6600",
      cta: { label: "Join Discord", url: "https://discord.gg/abc" },
    };
    expect(parseConfig(serializeConfig(cfg))).toEqual(cfg);
  });

  it("fills missing optional fields with defaults but keeps valid ones", () => {
    const raw = JSON.stringify({ v: 1, tz: "Europe/Berlin" });
    expect(parseConfig(raw)).toEqual({
      ...DEFAULT_CONFIG,
      tz: "Europe/Berlin",
    });
  });

  it("falls back to default tz when tz is not a recognized IANA zone", () => {
    const raw = JSON.stringify({ v: 1, tz: "Not/A/Real/Zone" });
    expect(parseConfig(raw).tz).toEqual(DEFAULT_CONFIG.tz);
  });

  it("falls back to default accentColor when hex is malformed", () => {
    expect(parseConfig(JSON.stringify({ v: 1, accentColor: "red" })).accentColor).toEqual(DEFAULT_CONFIG.accentColor);
    expect(parseConfig(JSON.stringify({ v: 1, accentColor: "#FFF" })).accentColor).toEqual(DEFAULT_CONFIG.accentColor);
    expect(parseConfig(JSON.stringify({ v: 1, accentColor: "#GGGGGG" })).accentColor).toEqual(DEFAULT_CONFIG.accentColor);
  });

  it("drops cta when url is not https", () => {
    const raw = JSON.stringify({ v: 1, cta: { label: "x", url: "http://insecure.example" } });
    expect(parseConfig(raw).cta).toBeNull();
  });

  it("drops cta when label is empty after trim or url is missing", () => {
    expect(parseConfig(JSON.stringify({ v: 1, cta: { label: "   ", url: "https://ok.com" } })).cta).toBeNull();
    expect(parseConfig(JSON.stringify({ v: 1, cta: { label: "ok" } })).cta).toBeNull();
  });

  it("trims and length-caps cta.label at 40 chars", () => {
    const longLabel = "a".repeat(80);
    const parsed = parseConfig(JSON.stringify({
      v: 1,
      cta: { label: `  ${longLabel}  `, url: "https://ok.com" },
    }));
    expect(parsed.cta?.label.length).toBe(40);
  });

  it("coerces showCollabs / showGame to booleans", () => {
    const raw = JSON.stringify({ v: 1, showCollabs: 0, showGame: "yes" });
    const parsed = parseConfig(raw);
    expect(parsed.showCollabs).toBe(false);
    expect(parsed.showGame).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/twitch/extensionConfigSchema.test.ts`
Expected: FAIL with "Cannot find module './extensionConfigSchema'"

- [ ] **Step 3: Implement the schema + parser**

```typescript
// lib/twitch/extensionConfigSchema.ts
//
// Broadcaster-set configuration for the Twitch extension. Persisted in
// Twitch's Extension Configuration Service (broadcaster segment). Read by
// both the SPA (client) and the panel API (server).
//
// IMPORTANT: This file is intentionally duplicated at
//   twitch-extension/src/lib/configSchema.ts
// because the SPA is a separate npm workspace and cannot import from this
// package. The body below "SCHEMA_BODY_START" through "SCHEMA_BODY_END"
// must remain byte-identical between the two files. A test enforces it.

// SCHEMA_BODY_START

export type ExtConfigV1 = {
  v: 1;
  tz: string;
  showCollabs: boolean;
  showGame: boolean;
  accentColor: string;
  cta: { label: string; url: string } | null;
};

export const DEFAULT_CONFIG: ExtConfigV1 = {
  v: 1,
  tz: "UTC",
  showCollabs: true,
  showGame: true,
  accentColor: "#9146FF",
  cta: null,
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function coerceBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true" || value === "yes" || value === "1") return true;
    if (value === "false" || value === "no" || value === "0") return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function parseCta(raw: unknown): ExtConfigV1["cta"] {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const url = typeof r.url === "string" ? r.url : "";
  const labelRaw = typeof r.label === "string" ? r.label : "";
  const label = labelRaw.trim().slice(0, 40);
  if (!label) return null;
  if (!url.startsWith("https://")) return null;
  return { label, url };
}

export function parseConfig(content: string | null | undefined): ExtConfigV1 {
  if (!content) return DEFAULT_CONFIG;
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return DEFAULT_CONFIG;
  }
  if (!raw || typeof raw !== "object") return DEFAULT_CONFIG;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return DEFAULT_CONFIG;

  const tz = isValidTimeZone(r.tz) ? r.tz : DEFAULT_CONFIG.tz;
  const accentColor =
    typeof r.accentColor === "string" && HEX_RE.test(r.accentColor)
      ? r.accentColor
      : DEFAULT_CONFIG.accentColor;

  return {
    v: 1,
    tz,
    showCollabs: coerceBool(r.showCollabs, DEFAULT_CONFIG.showCollabs),
    showGame: coerceBool(r.showGame, DEFAULT_CONFIG.showGame),
    accentColor,
    cta: parseCta(r.cta),
  };
}

export function serializeConfig(cfg: ExtConfigV1): string {
  return JSON.stringify(cfg);
}

// SCHEMA_BODY_END
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/twitch/extensionConfigSchema.test.ts`
Expected: PASS, 10 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/twitch/extensionConfigSchema.ts lib/twitch/extensionConfigSchema.test.ts
git commit -m "ext: shared broadcaster config schema + parser"
```

---

### Task 2: Mirror schema into SPA workspace + identity test

**Files:**
- Create: `twitch-extension/src/lib/configSchema.ts`
- Create: `lib/twitch/__tests__/configSchemaIdentity.test.ts`

- [ ] **Step 1: Write the identity test**

```typescript
// lib/twitch/__tests__/configSchemaIdentity.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MARK_START = "// SCHEMA_BODY_START";
const MARK_END = "// SCHEMA_BODY_END";

function extractBody(absPath: string): string {
  const content = readFileSync(absPath, "utf8");
  const start = content.indexOf(MARK_START);
  const end = content.indexOf(MARK_END);
  if (start === -1 || end === -1) {
    throw new Error(`Missing markers in ${absPath}`);
  }
  return content.slice(start + MARK_START.length, end).trim();
}

describe("config schema duplication", () => {
  it("backend and SPA copies have byte-identical body", () => {
    const backend = extractBody(resolve(__dirname, "../extensionConfigSchema.ts"));
    const spa = extractBody(resolve(__dirname, "../../../twitch-extension/src/lib/configSchema.ts"));
    expect(spa).toEqual(backend);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/twitch/__tests__/configSchemaIdentity.test.ts`
Expected: FAIL — SPA file does not exist.

- [ ] **Step 3: Create the SPA copy**

```typescript
// twitch-extension/src/lib/configSchema.ts
//
// IMPORTANT: This file is a deliberate duplicate of
//   lib/twitch/extensionConfigSchema.ts
// The body between SCHEMA_BODY_START and SCHEMA_BODY_END markers must
// remain byte-identical to that file. The identity test in
//   lib/twitch/__tests__/configSchemaIdentity.test.ts
// enforces this — update both files together.

// SCHEMA_BODY_START

export type ExtConfigV1 = {
  v: 1;
  tz: string;
  showCollabs: boolean;
  showGame: boolean;
  accentColor: string;
  cta: { label: string; url: string } | null;
};

export const DEFAULT_CONFIG: ExtConfigV1 = {
  v: 1,
  tz: "UTC",
  showCollabs: true,
  showGame: true,
  accentColor: "#9146FF",
  cta: null,
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function coerceBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true" || value === "yes" || value === "1") return true;
    if (value === "false" || value === "no" || value === "0") return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function parseCta(raw: unknown): ExtConfigV1["cta"] {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const url = typeof r.url === "string" ? r.url : "";
  const labelRaw = typeof r.label === "string" ? r.label : "";
  const label = labelRaw.trim().slice(0, 40);
  if (!label) return null;
  if (!url.startsWith("https://")) return null;
  return { label, url };
}

export function parseConfig(content: string | null | undefined): ExtConfigV1 {
  if (!content) return DEFAULT_CONFIG;
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return DEFAULT_CONFIG;
  }
  if (!raw || typeof raw !== "object") return DEFAULT_CONFIG;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return DEFAULT_CONFIG;

  const tz = isValidTimeZone(r.tz) ? r.tz : DEFAULT_CONFIG.tz;
  const accentColor =
    typeof r.accentColor === "string" && HEX_RE.test(r.accentColor)
      ? r.accentColor
      : DEFAULT_CONFIG.accentColor;

  return {
    v: 1,
    tz,
    showCollabs: coerceBool(r.showCollabs, DEFAULT_CONFIG.showCollabs),
    showGame: coerceBool(r.showGame, DEFAULT_CONFIG.showGame),
    accentColor,
    cta: parseCta(r.cta),
  };
}

export function serializeConfig(cfg: ExtConfigV1): string {
  return JSON.stringify(cfg);
}

// SCHEMA_BODY_END
```

- [ ] **Step 4: Run identity test**

Run: `npx vitest run lib/twitch/__tests__/configSchemaIdentity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add twitch-extension/src/lib/configSchema.ts lib/twitch/__tests__/configSchemaIdentity.test.ts
git commit -m "ext: spa-side config schema mirror + identity test"
```

---

## Phase 2 — TZ-aware pattern algorithm

### Task 3: Add `timezone` parameter and TZ-aware day/hour extraction to `analyzePatterns`

**Files:**
- Modify: `lib/scheduling/patterns.ts`
- Test: `lib/scheduling/patterns.test.ts` (file likely already exists; add new describe block)

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `lib/scheduling/patterns.test.ts` (create the file if it doesn't exist with the standard vitest imports):

```typescript
import { describe, it, expect } from "vitest";
import { analyzePatterns, type StreamSession } from "./patterns";

describe("analyzePatterns with timezone", () => {
  // Build a fixture: 12 sessions, all starting at 23:00 UTC on Sun/Mon/Wed.
  // In UTC binning these are Sun/Mon/Wed at hour 23.
  // In America/New_York (UTC-5 in winter), 23:00 UTC = 18:00 ET, still
  // Sun/Mon/Wed at hour 18.
  // In Asia/Tokyo (UTC+9), 23:00 UTC = 08:00 next day JST, so the days
  // shift to Mon/Tue/Thu at hour 8.
  function makeSessions(): StreamSession[] {
    const sessions: StreamSession[] = [];
    const baseSunday = new Date("2026-01-04T23:00:00Z"); // Sunday 23 UTC
    for (let i = 0; i < 4; i++) {
      const weekOffset = i * 7 * 86_400_000;
      for (const dowOffset of [0, 1, 3]) { // Sun, Mon, Wed
        const start = new Date(baseSunday.getTime() + weekOffset + dowOffset * 86_400_000);
        const end = new Date(start.getTime() + 4 * 3600_000);
        sessions.push({
          startTime: start,
          endTime: end,
          gameName: "Apex Legends",
          durationSec: 4 * 3600,
        });
      }
    }
    return sessions;
  }

  it("bins days in America/New_York", () => {
    const p = analyzePatterns(1, "Test", makeSessions(), [], "America/New_York");
    expect(p.typicalDays.slice(0, 3).sort()).toEqual(["Monday", "Sunday", "Wednesday"]);
    expect(p.startHours.median).toBe(18);
  });

  it("bins days in UTC (legacy default)", () => {
    const p = analyzePatterns(1, "Test", makeSessions(), [], "UTC");
    expect(p.typicalDays.slice(0, 3).sort()).toEqual(["Monday", "Sunday", "Wednesday"]);
    expect(p.startHours.median).toBe(23);
  });

  it("shifts days when binning in Asia/Tokyo", () => {
    const p = analyzePatterns(1, "Test", makeSessions(), [], "Asia/Tokyo");
    expect(p.typicalDays.slice(0, 3).sort()).toEqual(["Monday", "Thursday", "Tuesday"]);
    expect(p.startHours.median).toBe(8);
  });

  it("falls back to UTC when timezone arg is omitted", () => {
    const p = analyzePatterns(1, "Test", makeSessions(), []);
    expect(p.startHours.median).toBe(23);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scheduling/patterns.test.ts`
Expected: FAIL — `analyzePatterns` signature doesn't accept a 5th argument and current implementation bins in UTC, so `America/New_York` test fails.

- [ ] **Step 3: Add a TZ-aware helper to `patterns.ts`**

Insert this near the top of `lib/scheduling/patterns.ts` (after the constants):

```typescript
const DAY_NAME_TO_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function partsInTz(date: Date, timeZone: string): { dayIndex: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  let hour = parseInt(hourStr, 10);
  if (hour === 24) hour = 0; // Intl quirk: midnight is sometimes "24"
  return { dayIndex: DAY_NAME_TO_INDEX[weekday] ?? 0, hour };
}
```

- [ ] **Step 4: Update `analyzePatterns` signature and thread `timezone` through**

Replace the existing `analyzePatterns` and `analyzeFromHistory` / `analyzeFromSchedule` signatures so they accept `timezone`. Default it to `"UTC"` for the top-level export to keep existing callers working until they're updated.

```typescript
export function analyzePatterns(
  friendId: number,
  displayName: string,
  sessions: StreamSession[],
  scheduleHints: ScheduleHint[] = [],
  timezone: string = "UTC"
): StreamingPattern {
  if (sessions.length >= 3) {
    return analyzeFromHistory(friendId, displayName, sessions, scheduleHints, timezone);
  }
  if (scheduleHints.length > 0) {
    return analyzeFromSchedule(friendId, displayName, scheduleHints, sessions, timezone);
  }
  if (sessions.length > 0) {
    return analyzeFromHistory(friendId, displayName, sessions, scheduleHints, timezone);
  }
  return estimatedPattern(friendId, displayName);
}

function analyzeFromHistory(
  friendId: number,
  displayName: string,
  sessions: StreamSession[],
  scheduleHints: ScheduleHint[],
  timezone: string
): StreamingPattern {
  // ... see Task 4 for body changes
}

function analyzeFromSchedule(
  friendId: number,
  displayName: string,
  hints: ScheduleHint[],
  sessions: StreamSession[],
  timezone: string
): StreamingPattern {
  // ... see Task 4 for body changes
}
```

- [ ] **Step 5: Run tests — expect 3 of 4 still failing**

Run: `npx vitest run lib/scheduling/patterns.test.ts`
Expected: the "falls back to UTC" test passes; the three TZ-sensitive tests still fail because `analyzeFromHistory` body still uses `getUTCDay()`/`getUTCHours()`. That's fine — Task 4 fixes it.

- [ ] **Step 6: Commit (intermediate)**

```bash
git add lib/scheduling/patterns.ts lib/scheduling/patterns.test.ts
git commit -m "patterns: thread timezone param into analyzePatterns (binning still UTC)"
```

---

### Task 4: Switch binning to TZ-aware and weight only stream start

**Files:**
- Modify: `lib/scheduling/patterns.ts`

- [ ] **Step 1: Replace the body of `analyzeFromHistory`**

Find the current `analyzeFromHistory` function (~line 65 in the existing file) and replace its body with this version. Key changes: use `partsInTz` for binning, replace `addWindowWeight` with `addStartWeight` (single increment at start), drop the multi-hour spread.

```typescript
function analyzeFromHistory(
  friendId: number,
  displayName: string,
  sessions: StreamSession[],
  scheduleHints: ScheduleHint[],
  timezone: string
): StreamingPattern {
  const dayCounts = new Array(7).fill(0);
  const hourCounts = new Array(HOURS_PER_DAY).fill(0);
  const startHours: number[] = [];
  const gameCounts: Record<string, number> = {};
  let totalSec = 0;

  for (const s of sessions) {
    const weight = recencyWeight(s.startTime);
    const { dayIndex, hour } = partsInTz(s.startTime, timezone);
    dayCounts[dayIndex] += weight;
    hourCounts[hour] += weight;
    startHours.push(hour);
    if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + 1;
    totalSec += s.durationSec;
  }

  for (const h of scheduleHints) {
    const weight = h.isRecurring ? 0.9 : 0.65;
    const { dayIndex, hour } = partsInTz(h.startTime, timezone);
    dayCounts[dayIndex] += weight;
    hourCounts[hour] += weight;
  }

  const smoothedHourCounts = smoothCircular(hourCounts);
  const maxDay = Math.max(...dayCounts) || 1;
  const maxHour = Math.max(...smoothedHourCounts) || 1;
  const dayFrequency = dayCounts.map((c) => c / maxDay);
  const hourDistribution = smoothedHourCounts.map((c) => c / maxHour);

  const sortedDays = dayCounts
    .map((count, i) => ({ day: DAYS[i], count }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((d) => d.day);

  startHours.sort((a, b) => a - b);
  const medianHour = startHours[Math.floor(startHours.length / 2)];
  const earliest = Math.min(...startHours);
  const latest = Math.max(...startHours);

  const consistency = circularStdDev(startHours);

  const avgDurationHours =
    Math.round((totalSec / sessions.length / 3600) * 10) / 10 || DEFAULT_DURATION_HOURS;

  const topGames = Object.entries(gameCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([g]) => g);

  const n = sessions.length;
  const confidence: StreamingPattern["confidence"] =
    n >= 20 ? "strong" : n >= 10 ? "moderate" : "weak";

  const daysStr = sortedDays.slice(0, 3).join(", ") || "weekends";
  const gamesStr = topGames.slice(0, 3).join(", ") || "various games";
  const summary =
    `${displayName} typically streams on ${daysStr} around ${formatHour(medianHour)} ${timezone} ` +
    `for ~${avgDurationHours}h. Most played: ${gamesStr}. (${n} streams analyzed)`;

  return {
    friendId,
    displayName,
    typicalDays: sortedDays,
    startHours: { earliest, latest, median: medianHour },
    avgDurationHours,
    topGames,
    confidence,
    summary,
    inferredWindows: inferFutureWindows(sortedDays, medianHour, avgDurationHours),
    dayFrequency,
    hourDistribution,
    consistency,
    sampleSize: n,
  };
}
```

- [ ] **Step 2: Replace the body of `analyzeFromSchedule`** identically (use `partsInTz` for hints/sessions, drop `addWindowWeight`)

```typescript
function analyzeFromSchedule(
  friendId: number,
  displayName: string,
  hints: ScheduleHint[],
  sessions: StreamSession[],
  timezone: string
): StreamingPattern {
  const dayCounts = new Array(7).fill(0);
  const hourCounts = new Array(HOURS_PER_DAY).fill(0);
  const gameCounts: Record<string, number> = {};
  const durations: number[] = [];
  const hours: number[] = [];

  for (const h of hints) {
    const weight = h.isRecurring ? 2 : 1.2;
    const { dayIndex, hour } = partsInTz(h.startTime, timezone);
    dayCounts[dayIndex] += weight;
    hourCounts[hour] += weight;
    hours.push(hour);
    if (h.gameName) gameCounts[h.gameName] = (gameCounts[h.gameName] ?? 0) + weight;
    const dur = (h.endTime.getTime() - h.startTime.getTime()) / 3600000;
    if (dur > 0) durations.push(dur);
  }
  for (const s of sessions) {
    if (s.gameName) gameCounts[s.gameName] = (gameCounts[s.gameName] ?? 0) + recencyWeight(s.startTime) * 0.5;
  }

  const smoothedHourCounts = smoothCircular(hourCounts);
  const maxDay = Math.max(...dayCounts) || 1;
  const maxHour = Math.max(...smoothedHourCounts) || 1;
  const dayFrequency = dayCounts.map((c) => c / maxDay);
  const hourDistribution = smoothedHourCounts.map((c) => c / maxHour);

  const sortedDays = dayCounts
    .map((count, i) => ({ day: DAYS[i], count }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((d) => d.day);

  hours.sort((a, b) => a - b);
  const medianHour = hours[Math.floor(hours.length / 2)] ?? 20;
  const avgDurationHours =
    durations.length > 0
      ? Math.round((durations.reduce((a, b) => a + b) / durations.length) * 10) / 10
      : DEFAULT_DURATION_HOURS;

  const topGames = Object.entries(gameCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([g]) => g);

  const daysStr = sortedDays.slice(0, 3).join(", ") || "weekends";
  const gamesStr = topGames.slice(0, 3).join(", ") || "various games";
  const summary =
    `${displayName} has a posted schedule: ${daysStr} around ${formatHour(medianHour)} ${timezone} ` +
    `for ~${avgDurationHours}h. Games: ${gamesStr}. (from Twitch schedule)`;

  return {
    friendId,
    displayName,
    typicalDays: sortedDays,
    startHours: { earliest: Math.min(...hours), latest: Math.max(...hours), median: medianHour },
    avgDurationHours,
    topGames,
    confidence: "schedule",
    summary,
    inferredWindows: inferFutureWindows(sortedDays, medianHour, avgDurationHours),
    dayFrequency,
    hourDistribution,
    consistency: circularStdDev(hours),
    sampleSize: hints.length,
  };
}
```

- [ ] **Step 3: Delete `addWindowWeight` (no longer called) and update `StreamingPattern.startHours` doc comment**

Find and delete the entire `addWindowWeight` function (~lines 263-287 in the original). Also update the JSDoc on `startHours` in the `StreamingPattern` interface — change `Typical start hour in UTC` to `Typical start hour in the timezone passed to analyzePatterns`.

- [ ] **Step 4: Run all pattern tests**

Run: `npx vitest run lib/scheduling/patterns.test.ts`
Expected: all 4 TZ tests pass. Any pre-existing tests in the file may need a `"UTC"` arg added — update them in place to keep them passing.

- [ ] **Step 5: Run the full test suite to catch any other callers**

Run: `npx vitest run`
Expected: any other test files that call `analyzePatterns` without the new arg still pass because the default is `"UTC"`. If anything breaks, fix the caller in place.

- [ ] **Step 6: Commit**

```bash
git add lib/scheduling/patterns.ts lib/scheduling/patterns.test.ts
git commit -m "patterns: TZ-aware binning + start-only weighting

Stream history was binned in UTC and weight was spread across every live
hour, causing evening streams to roll into the next UTC day. Now bin
in the supplied timezone and weight only the start hour/day, which is
what the panel summary actually answers."
```

---

### Task 5: Update `extensionPredictions` response schema (`medianHour` + `tz`)

**Files:**
- Modify: `lib/twitch/extensionPredictions.ts`
- Modify: `lib/twitch/extensionPredictions.test.ts`

- [ ] **Step 1: Update the test fixture/expectations**

Open `lib/twitch/extensionPredictions.test.ts`. Find every assertion against `summary.medianHourUtc` and rename it to `summary.medianHour`. Find every test that calls `shapeConnectedPanelResponse(...)` and add a `timezone` arg to the input fixture (where appropriate) — pick `"UTC"` so existing numeric expectations don't shift.

Add this new test at the end of the existing `describe`:

```typescript
it("includes timezone in the summary", () => {
  const resp = shapeConnectedPanelResponse({
    pattern: basePattern,
    postedSchedule: [],
    upcomingCollabs: [],
    timezone: "America/New_York",
  });
  if (resp.status !== "ok") throw new Error("expected ok");
  expect(resp.summary.tz).toBe("America/New_York");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/twitch/extensionPredictions.test.ts`
Expected: FAIL — `tz` not in response, `shapeConnectedPanelResponse` doesn't accept `timezone`.

- [ ] **Step 3: Update `shapeConnectedPanelResponse` and its types**

In `lib/twitch/extensionPredictions.ts`:

1. In the `PanelResponse` type, rename `medianHourUtc` → `medianHour` and add `tz: string`.
2. Update the JSDoc above `medianHour` to say `Typical start hour in the timezone "tz" below.`
3. Change `shapeConnectedPanelResponse` to accept `timezone: string` in its input object and pass it through to the returned summary.
4. Default `timezone` to `"UTC"` if not provided.

```typescript
// Updated type
export type PanelResponse =
  | {
      status: "ok";
      summary: {
        topDays: string[];
        medianHour: number;       // in tz below
        tz: string;               // IANA timezone used for binning
        topGame: string | null;
        isEstimate: boolean;
        hasPostedSchedule: boolean;
      };
      collabs: Array<{
        startsAt: string;
        gameName: string | null;
        partners: Array<{ username: string; displayName: string; avatarUrl: string }>;
      }>;
      generatedAt: string;
    }
  | { status: "warming" }
  | { status: "no_data" };

// Updated function signature
export function shapeConnectedPanelResponse(input: {
  pattern: StreamingPattern;
  postedSchedule: Array<{ start: Date; end: Date }>;
  upcomingCollabs: Array<{
    startsAt: string;
    gameName: string | null;
    partners: Array<{ username: string; displayName: string; avatarUrl: string }>;
  }>;
  timezone?: string;
}): PanelResponse {
  const { pattern, postedSchedule, upcomingCollabs, timezone = "UTC" } = input;
  // ... rest unchanged except the return value:
  return {
    status: "ok",
    summary: {
      topDays,
      medianHour: medianHourUtc, // local variable name kept for diff clarity
      tz: timezone,
      topGame,
      isEstimate,
      hasPostedSchedule,
    },
    collabs: upcomingCollabs,
    generatedAt: new Date().toISOString(),
  };
}
```

(Local variable `medianHourUtc` inside the function can stay named that way or be renamed — pick `medianHour` for clarity if you rename.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/twitch/extensionPredictions.test.ts`
Expected: all tests pass including the new `tz` assertion.

- [ ] **Step 5: Commit**

```bash
git add lib/twitch/extensionPredictions.ts lib/twitch/extensionPredictions.test.ts
git commit -m "ext: rename medianHourUtc->medianHour, add tz to response"
```

---

### Task 6: Panel API route reads `?tz=` and threads it through

**Files:**
- Modify: `app/api/extension/channel/[channelId]/panel/route.ts`
- Modify: `app/api/extension/channel/[channelId]/panel/route.test.ts`

- [ ] **Step 1: Add tests for `?tz=` propagation**

Add this `describe` block to the existing test file:

```typescript
describe("panel route timezone handling", () => {
  it("passes the tz query param into analyzePatterns and into the response", async () => {
    // ... arrange a profile + friend + 3 sessions using the test harness already
    // used in the file. Use a fixture timezone "America/New_York".
    const req = new Request(
      "http://localhost/api/extension/channel/12345/panel?tz=America/New_York",
      { headers: { Authorization: `Bearer ${validJwt}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ channelId: "12345" }) });
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.summary.tz).toBe("America/New_York");
  });

  it("falls back to UTC when tz is missing", async () => {
    const req = new Request(
      "http://localhost/api/extension/channel/12345/panel",
      { headers: { Authorization: `Bearer ${validJwt}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ channelId: "12345" }) });
    const body = await res.json();
    expect(body.summary.tz).toBe("UTC");
  });

  it("falls back to UTC when tz is invalid", async () => {
    const req = new Request(
      "http://localhost/api/extension/channel/12345/panel?tz=Not/A/Real/Zone",
      { headers: { Authorization: `Bearer ${validJwt}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ channelId: "12345" }) });
    const body = await res.json();
    expect(body.summary.tz).toBe("UTC");
  });
});
```

(Re-use the existing JWT-mint helper and Prisma fixture pattern from the rest of `route.test.ts`. If those helpers don't exist, follow the same pattern as the existing tests — don't invent new infrastructure.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/api/extension/channel/\[channelId\]/panel/route.test.ts`
Expected: FAIL — route ignores `tz`.

- [ ] **Step 3: Update `route.ts` to read and validate `?tz=`**

Add a helper at module scope:

```typescript
function readTz(req: Request): string {
  const url = new URL(req.url);
  const raw = url.searchParams.get("tz");
  if (!raw) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: raw });
    return raw;
  } catch {
    return "UTC";
  }
}
```

In `GET`, after the JWT verify block, read `const tz = readTz(req);`. Pass `tz` into:
- `buildConnectedPayload(profile.id, channelId, tz)` (new signature)
- `handleUnconnected(channelId, tz)` (new signature)

Update both helper signatures to accept `timezone: string` and:
- In `buildConnectedPayload`: pass `timezone` into `analyzePatterns(...)` (the 5th arg) and into `shapeConnectedPanelResponse({ ..., timezone })`.
- In `handleUnconnected` → `computeAndCacheUnconnected`: same passthrough. The cache key needs to incorporate `tz` so cached UTC results aren't served to viewers asking for a different TZ — change the cache key from `twitchId` to a derived key `${twitchId}|${tz}` (Prisma update: composite key, or use a separate composite column, see Task 6.5 below). For v1 simplicity, keep the same cache row but **bypass the cache when `tz !== "UTC"`** for the unconnected path — these are rare on launch day and we can revisit if it becomes a perf issue.

Concrete diff for `route.ts`:

```typescript
// After JWT verify:
const tz = readTz(req);

const profile = await prisma.profile.findUnique({ where: { twitchId: channelId } });
if (profile) {
  const payload = await buildConnectedPayload(profile.id, channelId, tz);
  return json(payload, {
    headers: {
      "Cache-Control": `public, s-maxage=${CONNECTED_TTL_SECONDS}, stale-while-revalidate=60`,
    },
  });
}
return handleUnconnected(channelId, tz);
```

```typescript
async function buildConnectedPayload(
  userId: string,
  twitchId: string,
  timezone: string
): Promise<PanelResponse> {
  // Keep the existing Prisma fetches (friend lookup, streamHistory, scheduleSegments,
  // eventParticipants) and the sessions/hints/collabs mapping exactly as they are
  // in the current file. The only changes are:
  //   1. Add `timezone` arg to analyzePatterns:
  const pattern = analyzePatterns(friend.id, friend.displayName, sessions, hints, timezone);
  //   2. Add `timezone` to shapeConnectedPanelResponse input:
  return shapeConnectedPanelResponse({
    pattern,
    postedSchedule: segments.map((s) => ({ start: s.startTime, end: s.endTime })),
    upcomingCollabs: collabs,
    timezone,
  });
}

async function handleUnconnected(twitchId: string, timezone: string): Promise<NextResponse> {
  // For non-UTC requests, bypass the cache (rare on launch; revisit if hot).
  if (timezone !== "UTC") {
    return json(await computeUnconnectedNoCache(twitchId, timezone));
  }

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

  await prisma.extensionPredictionCache.upsert({
    where: { twitchId },
    create: {
      twitchId,
      payload: Prisma.DbNull,
      computedAt: now,
      expiresAt: new Date(now.getTime() + SENTINEL_TTL_MS),
    },
    update: {
      payload: Prisma.DbNull,
      computedAt: now,
      expiresAt: new Date(now.getTime() + SENTINEL_TTL_MS),
    },
  });

  after(() => computeAndCacheUnconnected(twitchId, timezone).catch((err) => {
    console.error(`[ext/panel] background analysis failed for ${twitchId}:`, err);
  }));

  return json({ status: "warming" });
}

async function computeUnconnectedNoCache(twitchId: string, timezone: string): Promise<PanelResponse> {
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

  const pattern = analyzePatterns(0, twitchId, sessions, hints, timezone);

  return shapeConnectedPanelResponse({
    pattern,
    postedSchedule: hints.map((h) => ({ start: h.startTime, end: h.endTime })),
    upcomingCollabs: [],
    timezone,
  });
}

async function computeAndCacheUnconnected(twitchId: string, timezone: string): Promise<void> {
  const payload = await computeUnconnectedNoCache(twitchId, timezone);
  const now = new Date();
  await prisma.extensionPredictionCache.upsert({
    where: { twitchId },
    create: {
      twitchId,
      payload: payload as unknown as Prisma.InputJsonValue,
      computedAt: now,
      expiresAt: new Date(now.getTime() + UNCONNECTED_TTL_MS),
    },
    update: {
      payload: payload as unknown as Prisma.InputJsonValue,
      computedAt: now,
      expiresAt: new Date(now.getTime() + UNCONNECTED_TTL_MS),
    },
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run app/api/extension/channel/\[channelId\]/panel/route.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/extension/channel/\[channelId\]/panel/
git commit -m "ext: panel route reads ?tz= and threads it through analyzePatterns"
```

---

## Phase 3 — Unify the two pattern algorithms

### Task 7: Create `/api/friends/[id]/pattern` endpoint

**Files:**
- Create: `app/api/friends/[id]/pattern/route.ts`
- Create: `app/api/friends/[id]/pattern/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/friends/[id]/pattern/route.test.ts
import { describe, it, expect } from "vitest";
import { GET } from "./route";
// + reuse the existing per-route test setup pattern in the codebase
// (prisma seed helpers, supabase mock for session). See
// app/api/extension/channel/[channelId]/panel/route.test.ts for example.

describe("GET /api/friends/[id]/pattern", () => {
  it("returns 401 when user is not signed in", async () => {
    const req = new Request("http://localhost/api/friends/1/pattern");
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("returns the streaming pattern for the friend with the user's profile timezone", async () => {
    // Seed: profile with timezone "America/New_York", friend belonging to profile
    // with 5 sessions. (Use the test harness already in the codebase.)
    const res = await GET(authedReq, { params: Promise.resolve({ id: friend.id.toString() }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.tz).toBe("America/New_York");
    expect(Array.isArray(body.summary.topDays)).toBe(true);
    expect(typeof body.summary.medianHour).toBe("number");
  });

  it("returns 404 when friend belongs to a different user", async () => {
    // Seed: friend belongs to userB; request as userA.
    const res = await GET(authedReqAsUserA, { params: Promise.resolve({ id: friendOfUserB.id.toString() }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/friends/\[id\]/pattern/route.test.ts`
Expected: FAIL — route does not exist.

- [ ] **Step 3: Implement the route**

```typescript
// app/api/friends/[id]/pattern/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerUser } from "@/lib/auth"; // use whatever the codebase has
import {
  analyzePatterns,
  type StreamSession,
  type ScheduleHint,
} from "@/lib/scheduling/patterns";
import { shapeConnectedPanelResponse } from "@/lib/twitch/extensionPredictions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const friendId = Number.parseInt(id, 10);
  if (!Number.isFinite(friendId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const friend = await prisma.friend.findFirst({
    where: { id: friendId, userId: user.id },
  });
  if (!friend) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { timezone: true },
  });
  const timezone = profile?.timezone || "UTC";

  const [history, segments] = await Promise.all([
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

  const pattern = analyzePatterns(friend.id, friend.displayName, sessions, hints, timezone);

  const response = shapeConnectedPanelResponse({
    pattern,
    postedSchedule: segments.map((s) => ({ start: s.startTime, end: s.endTime })),
    upcomingCollabs: [],
    timezone,
  });

  return NextResponse.json(response, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run app/api/friends/\[id\]/pattern/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/friends/\[id\]/pattern/
git commit -m "feat(api): /api/friends/[id]/pattern returns shared streaming pattern"
```

---

### Task 8: Replace client-side `getStreamingPattern` with the API call

**Files:**
- Modify: `app/friends/[id]/page.tsx`

- [ ] **Step 1: Read the current page to find where `pattern` is computed and consumed**

Open `app/friends/[id]/page.tsx`. Identify:
1. The local `getStreamingPattern` function (~lines 31–71).
2. The call site that produces `pattern` (likely uses `friend.streamHistory` and `friend.scheduleSegments` from SWR).
3. All JSX references to `pattern.topDays`, `pattern.typicalTime`, `pattern.topGames`, `pattern.avgHours`, `pattern.total`, `pattern.source`.

- [ ] **Step 2: Replace the local function with a SWR fetch**

```typescript
// Replace the local `getStreamingPattern` block + its call site with:

const { data: patternResponse } = useSWR<{
  status: "ok" | "warming" | "no_data";
  summary?: {
    topDays: string[];
    medianHour: number;
    tz: string;
    topGame: string | null;
    isEstimate: boolean;
    hasPostedSchedule: boolean;
  };
}>(friend ? `/api/friends/${friend.id}/pattern` : null, fetcher);

const pattern = (() => {
  if (!patternResponse || patternResponse.status !== "ok" || !patternResponse.summary) {
    return { topDays: [] as string[], typicalTime: "", topGames: [] as string[], avgHours: 0, total: 0, source: "estimated" as const };
  }
  const s = patternResponse.summary;
  const h = s.medianHour % 12 || 12;
  return {
    topDays: s.topDays.slice(0, 3),
    typicalTime: `~${h}${s.medianHour >= 12 ? "PM" : "AM"}`,
    topGames: s.topGame ? [s.topGame] : [],
    avgHours: friend?.streamHistory?.length
      ? Math.round((friend.streamHistory.reduce((a: number, x: { durationSec: number }) => a + x.durationSec, 0) / friend.streamHistory.length / 3600) * 10) / 10
      : 0,
    total: friend?.streamHistory?.length ?? 0,
    source: s.isEstimate ? ("estimated" as const) : ("history" as const),
  };
})();
```

(The local computation of `avgHours` and `total` is preserved client-side because the panel response doesn't include them — keeping the UI accurate without extending the API surface.)

- [ ] **Step 3: Delete the now-unused `getStreamingPattern` function and any imports it relied on**

- [ ] **Step 4: Compile + smoke-test the page**

Run: `npx next dev` and visit `/friends/<id>` for a test friend. Verify pattern card renders with the same days/time the panel shows. If you see no friend in dev, use whichever test friend the codebase ships seeded.

- [ ] **Step 5: Run tests + typecheck**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add app/friends/\[id\]/page.tsx
git commit -m "friends: detail page uses shared /pattern endpoint, drops duplicate algo"
```

---

## Phase 4 — Backend twitch-color endpoint

### Task 9: Create the JWT-protected twitch-color route

**Files:**
- Create: `app/api/extension/channel/[channelId]/twitch-color/route.ts`
- Create: `app/api/extension/channel/[channelId]/twitch-color/route.test.ts`

- [ ] **Step 1: Check what user-resolution helper exists in `lib/twitch/client.ts`**

Read `lib/twitch/client.ts` and confirm whether a `getUserById(id)` or similar helper exists. If not, add one (~10 lines using the existing Helix client pattern from `getRecentBroadcasts`). If it does exist, reuse it.

- [ ] **Step 2: Write the failing tests**

```typescript
// app/api/extension/channel/[channelId]/twitch-color/route.test.ts
import { describe, it, expect, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/twitch/client", () => ({
  getChatColor: vi.fn(async (login: string) => login === "thedeutschmark" ? "#FF6600" : ""),
  getUserById: vi.fn(async (id: string) => ({ id, login: "thedeutschmark", display_name: "thedeutschmark" })),
}));

describe("GET /api/extension/channel/[channelId]/twitch-color", () => {
  it("returns 401 when JWT is missing", async () => {
    const req = new Request("http://localhost/api/extension/channel/60131662/twitch-color");
    const res = await GET(req, { params: Promise.resolve({ channelId: "60131662" }) });
    expect(res.status).toBe(401);
  });

  it("returns the broadcaster color for a CP user (Profile.username path)", async () => {
    // seed profile with twitchId=60131662, username=thedeutschmark
    const res = await GET(authedReq, { params: Promise.resolve({ channelId: "60131662" }) });
    const body = await res.json();
    expect(body.color).toBe("#FF6600");
  });

  it("returns the broadcaster color for a non-CP user (Helix path)", async () => {
    // no profile for this twitchId
    const res = await GET(authedReq, { params: Promise.resolve({ channelId: "99999999" }) });
    const body = await res.json();
    // getUserById mock returns login "thedeutschmark" → getChatColor returns #FF6600
    expect(body.color).toBe("#FF6600");
  });

  it("returns null color when Twitch has none set", async () => {
    vi.mocked(getChatColor).mockResolvedValueOnce("");
    const res = await GET(authedReq, { params: Promise.resolve({ channelId: "60131662" }) });
    const body = await res.json();
    expect(body.color).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run app/api/extension/channel/\[channelId\]/twitch-color/route.test.ts`
Expected: FAIL — route doesn't exist.

- [ ] **Step 4: Implement the route**

```typescript
// app/api/extension/channel/[channelId]/twitch-color/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyExtensionJwt, ExtensionJwtError } from "@/lib/twitch/extensionJwt";
import { getChatColor, getUserById } from "@/lib/twitch/client";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function json(body: unknown, init: ResponseInit = {}) {
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
  if (!token) return json({ error: "missing_token" }, { status: 401 });

  const secret = process.env.TWITCH_EXTENSION_SECRET;
  if (!secret) return json({ error: "server_misconfigured" }, { status: 500 });

  try {
    await verifyExtensionJwt(token, secret, { expectChannelId: channelId });
  } catch (err) {
    if (err instanceof ExtensionJwtError) return json({ error: "invalid_token" }, { status: 401 });
    throw err;
  }

  let login: string | null = null;
  const profile = await prisma.profile.findUnique({
    where: { twitchId: channelId },
    select: { username: true },
  });
  if (profile?.username) {
    login = profile.username;
  } else {
    try {
      const user = await getUserById(channelId);
      login = user?.login ?? null;
    } catch {
      // Helix failure — return null color
    }
  }

  if (!login) return json({ color: null });

  const hex = await getChatColor(login);
  return json({ color: hex || null }, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
```

If `getUserById` does not already exist in `lib/twitch/client.ts`, add it:

```typescript
// lib/twitch/client.ts (append)
export async function getUserById(id: string): Promise<{ id: string; login: string; display_name: string } | null> {
  const token = await getAppToken(); // reuse whatever the codebase has
  const res = await fetch(`https://api.twitch.tv/helix/users?id=${encodeURIComponent(id)}`, {
    headers: {
      "Client-Id": process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const u = json?.data?.[0];
  return u ? { id: u.id, login: u.login, display_name: u.display_name } : null;
}
```

(If the codebase's Helix wrapper pattern differs, follow it instead. Don't invent new infrastructure — match existing.)

- [ ] **Step 5: Run tests**

Run: `npx vitest run app/api/extension/channel/\[channelId\]/twitch-color/route.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/extension/channel/\[channelId\]/twitch-color/ lib/twitch/client.ts
git commit -m "feat(api): twitch-color endpoint for ext settings page"
```

---

## Phase 5 — Config page

### Task 10: Build the SettingsForm component

**Files:**
- Create: `twitch-extension/src/components/SettingsForm.tsx`
- Create: `twitch-extension/src/lib/contrast.ts`
- Modify: `twitch-extension/src/lib/twitchExt.ts` (add `awaitConfiguration` + `setConfiguration`)
- Modify: `twitch-extension/src/styles.css` (add accent CSS custom property)

- [ ] **Step 1: Add `pickTextColor` contrast helper**

```typescript
// twitch-extension/src/lib/contrast.ts
//
// Pick black or white text to put on top of a hex background, per WCAG
// relative luminance. Returns "#000000" or "#FFFFFF".
export function pickTextColor(hex: string): "#000000" | "#FFFFFF" {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return "#FFFFFF";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return L > 0.5 ? "#000000" : "#FFFFFF";
}
```

- [ ] **Step 2: Extend `twitchExt.ts` helpers**

Append to `twitch-extension/src/lib/twitchExt.ts`:

```typescript
/** Resolve once the broadcaster's stored configuration has loaded. */
export function awaitConfiguration(): Promise<string | null> {
  return new Promise((resolve) => {
    const ext = window.Twitch?.ext;
    if (!ext?.configuration) {
      resolve(null);
      return;
    }
    // configuration.broadcaster may already be populated synchronously
    if (ext.configuration.broadcaster?.content !== undefined) {
      resolve(ext.configuration.broadcaster.content ?? null);
      return;
    }
    ext.configuration.onChanged?.(() => {
      resolve(ext.configuration?.broadcaster?.content ?? null);
    });
  });
}

/** Persist broadcaster config to Twitch's Configuration Service. */
export function setBroadcasterConfiguration(version: string, content: string): void {
  const ext = window.Twitch?.ext;
  if (!ext?.configuration) {
    throw new Error("Twitch.ext.configuration not available");
  }
  // The helper API is `Twitch.ext.configuration.set(segment, version, content)`
  // (untyped in the helper). Cast through unknown.
  const cfg = ext.configuration as unknown as {
    set: (segment: "broadcaster", version: string, content: string) => void;
  };
  cfg.set("broadcaster", version, content);
}
```

Also update the `TwitchExtGlobal` interface in the same file to declare `configuration.onChanged`:

```typescript
interface TwitchExtGlobal {
  onAuthorized: (cb: (auth: TwitchAuth) => void) => void;
  onContext?: (cb: (ctx: Record<string, unknown>) => void) => void;
  configuration?: {
    broadcaster?: { content?: string; version?: string };
    onChanged?: (cb: () => void) => void;
  };
}
```

(The interface already has most of this — confirm and extend in place.)

- [ ] **Step 3: Add the `--accent` CSS variable + accent-aware styles**

Append to `twitch-extension/src/styles.css`:

```css
:root {
  --accent: #9146FF;
  --accent-text: #FFFFFF;
}

.accent-bg { background-color: var(--accent); color: var(--accent-text); }
.accent-fg { color: var(--accent); }
.day-pill.active { background-color: var(--accent); color: var(--accent-text); }
.cta { background-color: var(--accent); color: var(--accent-text); }
```

(Existing pill / CTA styles in the file may need their hard-coded colors replaced with `var(--accent)` — search the file and update in place.)

- [ ] **Step 4: Build `SettingsForm.tsx`**

```tsx
// twitch-extension/src/components/SettingsForm.tsx
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CONFIG, parseConfig, serializeConfig, type ExtConfigV1 } from "../lib/configSchema";
import { setBroadcasterConfiguration } from "../lib/twitchExt";

const CONFIG_VERSION = "1";

interface Props {
  initialRaw: string | null;
  channelId: string;
  token: string;
}

export function SettingsForm({ initialRaw, channelId, token }: Props) {
  const initial = useMemo(() => {
    const parsed = parseConfig(initialRaw);
    if (!initialRaw) {
      // First-time visitor: pre-fill TZ from the browser
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return { ...parsed, tz: detected };
    }
    return parsed;
  }, [initialRaw]);

  const [tz, setTz] = useState(initial.tz);
  const [showCollabs, setShowCollabs] = useState(initial.showCollabs);
  const [showGame, setShowGame] = useState(initial.showGame);
  const [accentColor, setAccentColor] = useState(initial.accentColor);
  const [ctaLabel, setCtaLabel] = useState(initial.cta?.label ?? "");
  const [ctaUrl, setCtaUrl] = useState(initial.cta?.url ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [colorFetchStatus, setColorFetchStatus] = useState<"idle" | "loading" | "none">("idle");

  const tzOptions = useMemo(() => {
    type SupportedValuesOf = (key: "timeZone") => string[];
    const supported = (Intl as unknown as { supportedValuesOf?: SupportedValuesOf }).supportedValuesOf;
    return supported ? supported("timeZone") : [];
  }, []);

  async function fetchTwitchColor() {
    setColorFetchStatus("loading");
    try {
      const res = await fetch(
        `https://collab.deutschmark.online/api/extension/channel/${channelId}/twitch-color`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const body = await res.json();
      if (body.color) {
        setAccentColor(body.color);
        setColorFetchStatus("idle");
      } else {
        setColorFetchStatus("none");
      }
    } catch {
      setColorFetchStatus("none");
    }
  }

  function buildConfig(): ExtConfigV1 {
    const trimmedLabel = ctaLabel.trim().slice(0, 40);
    const cta = trimmedLabel && ctaUrl.startsWith("https://")
      ? { label: trimmedLabel, url: ctaUrl }
      : null;
    return {
      v: 1,
      tz,
      showCollabs,
      showGame,
      accentColor,
      cta,
    };
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      const cfg = buildConfig();
      setBroadcasterConfiguration(CONFIG_VERSION, serializeConfig(cfg));
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="settings-form" onSubmit={save}>
      <label>
        <span>Timezone</span>
        <input
          list="tz-options"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          placeholder="America/New_York"
        />
        <datalist id="tz-options">
          {tzOptions.map((z) => <option key={z} value={z} />)}
        </datalist>
        <small>This setting is separate from your Collab Planner timezone.</small>
      </label>

      <label className="checkbox">
        <input type="checkbox" checked={showCollabs} onChange={(e) => setShowCollabs(e.target.checked)} />
        <span>Show upcoming collabs</span>
      </label>

      <label className="checkbox">
        <input type="checkbox" checked={showGame} onChange={(e) => setShowGame(e.target.checked)} />
        <span>Show top game</span>
      </label>

      <label>
        <span>Accent color</span>
        <span className="accent-row">
          <input
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value.toUpperCase())}
          />
          <button type="button" onClick={fetchTwitchColor}>
            {colorFetchStatus === "loading" ? "Fetching…" : "Use my Twitch profile color"}
          </button>
          {colorFetchStatus === "none" && <small>No Twitch chat color set on your account.</small>}
        </span>
      </label>

      <fieldset>
        <legend>Custom button (optional)</legend>
        <label>
          <span>Label</span>
          <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={40} />
        </label>
        <label>
          <span>URL</span>
          <input
            type="url"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            placeholder="https://discord.gg/..."
          />
        </label>
      </fieldset>

      <button type="submit" className="cta" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save"}
      </button>
      {status === "saved" && <span className="saved-toast">Saved ✓</span>}
      {status === "error" && <span className="error">Couldn't save — try again.</span>}
    </form>
  );
}
```

- [ ] **Step 5: Add minimal styles for the form**

Append to `twitch-extension/src/styles.css`:

```css
.settings-form { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
.settings-form label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem; }
.settings-form label.checkbox { flex-direction: row; align-items: center; gap: 0.5rem; }
.settings-form input[type="text"],
.settings-form input[type="url"],
.settings-form input:not([type]) { padding: 0.375rem 0.5rem; border: 1px solid hsl(0 0% 80%); border-radius: 4px; }
.settings-form fieldset { border: 1px solid hsl(0 0% 85%); border-radius: 4px; padding: 0.5rem; }
.settings-form fieldset legend { font-size: 0.75rem; padding: 0 0.25rem; }
.settings-form .accent-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.settings-form .saved-toast { color: hsl(120 60% 35%); font-size: 0.875rem; }
.settings-form small { color: hsl(0 0% 50%); font-size: 0.75rem; }
```

- [ ] **Step 6: Commit**

```bash
git add twitch-extension/src/components/SettingsForm.tsx twitch-extension/src/lib/contrast.ts twitch-extension/src/lib/twitchExt.ts twitch-extension/src/styles.css
git commit -m "ext: settings form + accent CSS var + twitch helper extensions"
```

---

### Task 11: Wire SettingsForm into config.tsx

**Files:**
- Modify: `twitch-extension/src/config.tsx`

- [ ] **Step 1: Refactor `config.tsx` so the form renders alongside the status strip**

Replace the existing render branches in `config.tsx` so that the form is shown in every authenticated state (loading shows a skeleton; error still shows). Pseudo-diff:

```tsx
// Inside Config():
const [authState, setAuthState] = useState<TwitchAuth | null>(null);
const [configRaw, setConfigRaw] = useState<string | null>(null);

useEffect(() => {
  // preview-mode branch unchanged

  Promise.all([awaitAuthorized(), awaitConfiguration()])
    .then(([auth, rawCfg]) => {
      setAuthState(auth);
      setConfigRaw(rawCfg);
      // existing fetchPanel logic to compute status strip
      // ...
    })
    .catch((err) => setState({ kind: "error", message: err.message }));
}, []);

return (
  <>
    <StatusStrip state={state} />
    {authState && (
      <SettingsForm
        initialRaw={configRaw}
        channelId={authState.channelId}
        token={authState.token}
      />
    )}
  </>
);
```

Extract the current status-rendering JSX into a small `<StatusStrip state={state} />` component co-located in the same file (or a new file under `components/`).

- [ ] **Step 2: Manual smoke test in Local Test mode**

```bash
cd twitch-extension && npm run dev
```

Open the Twitch dev console → Local Test → load the extension on your channel. Open the dashboard → Extensions → "Configure" your local-test extension. You should see the status strip + the form. Try changing TZ + clicking Save; refresh; verify values persist.

- [ ] **Step 3: Commit**

```bash
git add twitch-extension/src/config.tsx
git commit -m "ext: config page renders settings form below status strip"
```

---

## Phase 6 — Panel reads broadcaster config

### Task 12: Panel SPA reads config and applies presentation toggles

**Files:**
- Modify: `twitch-extension/src/panel.tsx`
- Modify: `twitch-extension/src/lib/api.ts`
- Modify: `twitch-extension/src/lib/types.ts`
- Modify: `twitch-extension/src/components/ScheduleSummary.tsx`

- [ ] **Step 1: Update `types.ts` to match the new server schema**

```typescript
// twitch-extension/src/lib/types.ts
export type PanelResponse =
  | {
      status: "ok";
      summary: {
        topDays: string[];
        medianHour: number;
        tz: string;
        topGame: string | null;
        isEstimate: boolean;
        hasPostedSchedule: boolean;
      };
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

- [ ] **Step 2: Update `api.ts` to pass `tz`**

```typescript
// twitch-extension/src/lib/api.ts
const API_BASE = "https://collab.deutschmark.online";

export async function fetchPanel(channelId: string, token: string, tz: string): Promise<PanelResponse> {
  const url = `${API_BASE}/api/extension/channel/${channelId}/panel?tz=${encodeURIComponent(tz)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`panel fetch failed: ${res.status}`);
  return (await res.json()) as PanelResponse;
}
```

- [ ] **Step 3: Update `panel.tsx` to read config and apply it**

Insert at the top of the `useEffect` (after the preview-mode short-circuit):

```typescript
Promise.all([awaitAuthorized(), awaitConfiguration()])
  .then(async ([auth, rawCfg]) => {
    const cfg = parseConfig(rawCfg);
    // Apply accent color globally for this render tree
    document.documentElement.style.setProperty("--accent", cfg.accentColor);
    document.documentElement.style.setProperty("--accent-text", pickTextColor(cfg.accentColor));
    const fmt: FormatOptions = {
      locale: resolveViewerLocale(undefined),
      timeZone: resolveViewerTimeZone(),
    };
    setConfig(cfg);
    return load(auth, fmt, cfg);
  })
  .catch((err) => setState({ kind: "error", message: err.message }));
```

Change `load` to take `cfg: ExtConfigV1` and pass `cfg.tz` into `fetchPanel(auth.channelId, auth.token, cfg.tz)`.

Add a `useState<ExtConfigV1>(DEFAULT_CONFIG)` for `config`. In the render:

```tsx
return (
  <>
    <ScheduleSummary summary={state.data.summary} />
    {config.showCollabs && <CollabsList collabs={state.data.collabs} format={state.fmt} />}
    <PoweredByFooter campaign="panel_footer" cta={config.cta} />
  </>
);
```

(If `PoweredByFooter` doesn't currently accept a `cta` prop, add one — when present, it renders the custom button; when null, it renders the existing default.)

- [ ] **Step 4: Update `ScheduleSummary` to honor `showGame` and format `medianHour` in `tz`**

```tsx
// twitch-extension/src/components/ScheduleSummary.tsx
import type { ExtConfigV1 } from "../lib/configSchema";

interface Props {
  summary: {
    topDays: string[];
    medianHour: number;
    tz: string;
    topGame: string | null;
    isEstimate: boolean;
  };
  showGame: boolean; // new prop
}

function formatHourInTz(hour: number, tz: string): string {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  // We display the broadcaster's local clock, not the viewer's. Twitch panel
  // viewers see a label like "~7PM ET" and understand it's the streamer's TZ.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "numeric", hour12: true, timeZoneName: "short",
  });
  const parts = fmt.formatToParts(date);
  const h = parts.find((p) => p.type === "hour")?.value ?? `${hour}`;
  const ampm = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
  const tzShort = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  return `~${h}${ampm} ${tzShort}`.trim();
}

export function ScheduleSummary({ summary, showGame }: Props) {
  return (
    <div className="schedule-summary">
      <p>Streams {summary.topDays.join(", ")} {formatHourInTz(summary.medianHour, summary.tz)}</p>
      {showGame && summary.topGame && <p className="top-game">{summary.topGame}</p>}
    </div>
  );
}
```

In `panel.tsx`, pass `showGame={config.showGame}` to `<ScheduleSummary />`.

- [ ] **Step 5: Manual smoke test in Local Test mode**

```bash
cd twitch-extension && npm run dev
```

Toggle the showCollabs / showGame checkboxes in the config page, save, then refresh the panel on your channel — confirm sections appear/disappear. Set a custom accent color — confirm pills and CTA take it. Set a custom CTA — confirm it replaces the default footer button.

- [ ] **Step 6: Commit**

```bash
git add twitch-extension/src/
git commit -m "ext: panel reads broadcaster config, applies tz/toggles/accent/cta"
```

---

## Phase 7 — Deployment

### Task 13: Bump version, rebuild, package, configure Twitch dev console

**Files:**
- Modify: `twitch-extension/package.json` — version `0.1.0` → `0.2.0`
- Modify: `twitch-extension/manifest.json` (if version is tracked there)

- [ ] **Step 1: Bump version**

```bash
# In twitch-extension/package.json
"version": "0.2.0",
```

Also update `manifest.json` if it has a version field — open and inspect.

- [ ] **Step 2: Build + package**

```bash
cd twitch-extension
npm run build
npm run package
```

Verify: `collab-planner-ext-0.2.0.zip` exists and (from project root):

```bash
node -e "
const fs = require('fs');
const buf = fs.readFileSync('twitch-extension/collab-planner-ext-0.2.0.zip');
const sig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
let i = 0;
while ((i = buf.indexOf(sig, i)) !== -1) {
  const nameLen = buf.readUInt16LE(i + 26);
  const extraLen = buf.readUInt16LE(i + 28);
  console.log(JSON.stringify(buf.slice(i + 30, i + 30 + nameLen).toString('utf8')));
  i += 30 + nameLen + extraLen + buf.readUInt32LE(i + 18);
}"
```

All entries must use forward slashes. If any backslashes appear, the 7-Zip fallback didn't fire — fix `scripts/zip.mjs` before continuing.

- [ ] **Step 3: Twitch dev console — capability change requires Local Test demote first**

Per `dev.twitch.tv/docs/extensions/life-cycle`, changing version details (including Capabilities) while in Hosted Test requires demoting to Local Test, editing, then re-promoting.

1. Twitch dev console → your extension → Versions → 0.1.0 → **Move to Local Test**.
2. (Or create a fresh 0.2.0 version via "Create New Version" — preferred for cleaner separation.)
3. On version 0.2.0:
   - Capabilities tab → "Configuration method" → **Extension Configuration Service** → Save.
   - Strip trailing slashes from all allowlist domains (done in earlier session — verify).
   - Asset Hosting → Files → upload `collab-planner-ext-0.2.0.zip`.
   - Move to **Hosted Test**.

- [ ] **Step 4: Re-install on your channel**

Twitch Creator Dashboard → Extensions → My Extensions → find 0.2.0 → Install → Configure → assign to a Panel slot → Save.

Open the dashboard's "Configure" panel for the extension. The settings form should render. Save a config. Refresh your channel page. The panel should render days/hours in the broadcaster TZ, with your accent color and CTA.

- [ ] **Step 5: Run the production user verification**

Verify against the production fixture you reported in the design session: with `tz=America/New_York`, the panel summary for `thedeutschmark` (channel 60131662, 31 sessions) should show `topDays` = `["Sun", "Mon", "Wed"]` (or whatever the actual local-TZ binning produces, which should align with the Collab Planner web app).

- [ ] **Step 6: Final commit**

```bash
git add twitch-extension/package.json twitch-extension/manifest.json
git commit -m "ext: bump to 0.2.0 — settings page + tz fix"
```

---

## Post-implementation

- [ ] Run full test suite one final time: `npx vitest run` — all green.
- [ ] Run typecheck: `npx tsc --noEmit` — no errors.
- [ ] Update the `memory/twitch-extension.md` memory file (or add a new one) noting that Configuration Service is now the source of truth for broadcaster settings and `analyzePatterns` takes a TZ parameter.
- [ ] When 0.2.0 is verified working, submit for Review per Twitch lifecycle so it can be released and visible to public viewers.
