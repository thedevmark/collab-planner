# Twitch Extension — Broadcaster Settings + Timezone Algorithm Fix

**Date:** 2026-05-24
**Status:** Design — pending implementation plan

## Problem

Two bugs surfaced together during the first Hosted-Test rollout of the panel extension:

1. **Wrong prediction output.** The panel showed "Streams Tue, Thu, Sun ~10PM" for a broadcaster whose Collab Planner app correctly reads "Sun Mon Wed ~7PM ET". Root cause is twofold:
   - `lib/scheduling/patterns.ts::addWindowWeight` bins day-of-week and hour-of-day in **UTC** (`cursor.getUTCDay()`, `cursor.getUTCHours()`), and spreads weight across every hour the stream was live. For any evening stream in the Americas, this rolls 3–4 hours of weight onto the *next* UTC day. A 7 PM ET Sunday stream contributes 1 weight to Sunday + 3 weights to Monday — flipping the top-day ranking.
   - `medianHourUtc` is returned as a raw UTC clock value and rendered as-is in the SPA, never converted to the broadcaster's intended TZ.
   - The friend detail page at `app/friends/[id]/page.tsx::getStreamingPattern` (client-side) uses a completely independent algorithm that happens to bin in browser-local time and weight only the start hour. The two will keep drifting because there is no shared implementation.

2. **No broadcaster-controllable configuration.** The extension's `config.html` is informational only. Broadcasters cannot set their TZ, toggle the collabs/game display, or supply a custom call-to-action. Non-CP broadcasters in particular have no path to influence what their panel shows.

## Goal

Ship a single bundled change that:

- Lets any broadcaster (CP or non-CP) configure their extension from the Twitch dashboard config page.
- Persists those settings in Twitch's Extension Configuration Service (no Collab Planner account required).
- Threads the broadcaster's timezone through the prediction algorithm so the panel shows correct days/hours.
- Eliminates the duplicate pattern algorithm so the friend detail page and the panel can never diverge again.

## Non-goals

- Updating `Profile.timezone` from the extension settings page. The two surfaces (CP app, Twitch extension) own independent TZ values, deliberately. Avoids dual-write / sync coordination.
- A general settings UI in the Collab Planner web app. Out of scope.
- Telemetry for which settings broadcasters choose. Out of scope; add later if needed.
- Migrating existing broadcasters' settings. Nobody has settings yet (the feature didn't exist).
- Supporting Configuration Service segments other than `broadcaster` (no `developer` or `global` segment use).

## Architecture

### Persistence: Twitch Extension Configuration Service is the single source of truth

Settings are stored in Twitch's Configuration Service `broadcaster` segment, set client-side via:

```
window.Twitch.ext.configuration.set("broadcaster", "1", JSON.stringify(config));
```

The dev console "Configuration method" capability moves from `No configuration` to `Extension Configuration Service`.

**Why not store in Collab Planner Postgres:**

- Works for non-CP broadcasters with no extra UX path (no signup wall before they can use settings).
- The SPA reads the broadcaster's saved config via `Twitch.ext.configuration.broadcaster.content` automatically on every panel/config render — no API round-trip for presentation toggles.
- Eliminates a dual-write / sync problem with `Profile.timezone`.
- Twitch enforces write-authorization at the JWT layer (only the broadcaster's own JWT can call `configuration.set("broadcaster", ...)`).

### Server-side TZ access: passed as a query parameter

The panel API needs the broadcaster's TZ to bin stream history correctly. The SPA reads the config client-side and passes the timezone as `?tz=America/New_York` on its panel request. Backend validates it via `Intl.DateTimeFormat(undefined, { timeZone: tz })` in try/catch and falls back to `"UTC"` if invalid.

A viewer who forges the value only affects the panel rendered in *their own browser*. No data exfil, no cross-broadcaster impact — the backend never writes anything based on this value. Acceptable.

### `Profile.timezone` is left alone

It continues to power calendar exports and other Collab Planner-internal features. The extension does not read from or write to it. Users who want their extension TZ and their CP TZ to match must set both. Documented in the config page UI ("This setting is separate from your Collab Planner timezone").

## Settings schema

Single JSON object, versioned, max 5KB (Twitch limit; we'll use <500B):

```typescript
type ExtConfigV1 = {
  v: 1;
  tz: string;                                   // IANA TZ, e.g. "America/New_York"
  showCollabs: boolean;
  showGame: boolean;
  accentColor: string;                          // "#RRGGBB" — panel accent
  cta: { label: string; url: string } | null;   // null = use default CTA
};

const DEFAULT: ExtConfigV1 = {
  v: 1,
  tz: "UTC",
  showCollabs: true,
  showGame: true,
  accentColor: "#9146FF",                       // Twitch purple
  cta: null,
};
```

A single `parseConfig(raw: string | null | undefined): ExtConfigV1` function is the only entry point, used by both SPA and backend. Bad JSON, missing fields, unknown `v` — all return defaults. Forward-compatible: a v1 reader seeing a v2 payload falls back to defaults gracefully.

Lives in **two files** (one per workspace) with identical content:

- `twitch-extension/src/lib/configSchema.ts`
- `lib/twitch/extensionConfigSchema.ts`

A test asserts the two files are byte-identical (or compute the same defaults for the same inputs). Duplication is intentional — the extension SPA is a separate npm workspace and cannot import from the Next app.

### Validation rules

- `tz`: validated via `Intl.DateTimeFormat(undefined, { timeZone: tz })`. On the config page the input is a `<datalist>` populated from `Intl.supportedValuesOf("timeZone")`. Backend re-validates and falls back to `"UTC"` on failure.
- `accentColor`: must match `/^#[0-9a-fA-F]{6}$/`. Backend re-validates; invalid value falls back to `"#9146FF"`. Applied as a CSS custom property `--accent` on the panel root and consumed by `ScheduleSummary`, day-pills, and the CTA button background. Text-on-accent uses the WCAG-relative-luminance pick: pure white if accent is dark, near-black if accent is light.
- `cta.label`: trimmed, max 40 chars, plain text (rendered with React's default text escaping; no `dangerouslySetInnerHTML`).
- `cta.url`: must start with `https://`. Reject anything else. Renders with `target="_blank" rel="noopener noreferrer"`.
- `showCollabs`, `showGame`: coerced to boolean.

## Config page UI

Layout (top to bottom):

1. **Status strip** (existing behavior, unchanged): "Loading", "Not in CP — Sign in ↗", "Connected ✓ · streams Sun, Mon, Wed", "Analyzing your recent broadcasts…", or "Unable to load".
2. **Settings form**, always visible (works without a CP account):

   ```
   Timezone           [ America/New_York ▾ ]
                      (Helper: "This setting is separate from your Collab Planner timezone.")

   ☑ Show upcoming collabs
   ☑ Show top game

   Accent color    [ ■ #9146FF ]   [ Use my Twitch profile color ]

   Custom button (optional)
     Label   [ Join my Discord       ]
     URL     [ https://discord.gg/…  ]

                                                  [ Save ]
   ```

3. After Save: inline "Saved ✓" microcopy that fades after 2s.

**Initial timezone value:** if no config has been saved yet, auto-fill `Intl.DateTimeFormat().resolvedOptions().timeZone` in the input. Broadcaster accepts or changes it. Most will just click Save.

**"Use my Twitch profile color" button:** calls `GET /api/extension/channel/[channelId]/twitch-color` (new endpoint, JWT-protected) which resolves the broadcaster's chat color via the existing `getChatColor()` helper in `lib/twitch/client.ts`. For CP users the login is read from `Profile.username`; for non-CP users the backend does a Helix `Get Users` call by channel_id to resolve the login, then calls `getChatColor`. Returns `{ color: "#RRGGBB" | null }`. UI populates the color picker with the result, or shows "no chat color set" microcopy if Twitch returns empty. Twitch's GraphQL endpoint is unauthenticated, so this works for any broadcaster.

## Algorithm fix

### Change 1 — bin in the broadcaster's TZ

`lib/scheduling/patterns.ts::analyzePatterns` accepts a new `timezone: string` parameter, threaded down to `analyzeFromHistory`, `analyzeFromSchedule`, and `addWindowWeight`. Day-of-week and hour-of-day extraction switches from `getUTCDay()`/`getUTCHours()` to TZ-aware extraction via:

```typescript
function partsInTz(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short", hour: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")!.value; // "Sun"..."Sat"
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  return { weekday, hour };
}
```

### Change 2 — weight only the start hour/day in `analyzeFromHistory`

The panel summary answers "when does this person *start* streaming". Spreading weight across every hour the stream is live is wrong for that question and is the proximate cause of day-bin flipping for evening streams. Replace the multi-hour spread inside `addWindowWeight` (lines 282–286) with a single increment at the start hour/day. The function reduces to:

```typescript
function addStartWeight(dayCounts, hourCounts, start, weight, tz) {
  const { weekday, hour } = partsInTz(start, tz);
  dayCounts[DAYS.indexOf(weekday)] += weight;
  hourCounts[hour] += weight;
}
```

`hourDistribution` and `dayFrequency` (the normalized histograms used elsewhere) are unaffected in shape — they still reflect start times rather than coverage. If any downstream consumer needs hourly coverage, that's a separate signal and not what these fields are for.

### Change 3 — response schema renames `medianHourUtc` → `medianHour` + adds `tz`

```typescript
type PanelOk = {
  status: "ok";
  summary: {
    topDays: string[];
    medianHour: number;       // in tz below
    tz: string;               // IANA TZ used for binning
    topGame: string | null;
    isEstimate: boolean;
    hasPostedSchedule: boolean;
  };
  collabs: Array<…>;
  generatedAt: string;
};
```

The SPA renders the median hour by formatting in `tz` and labels it (e.g. "~7PM ET") so viewers in other TZs aren't confused.

### Change 4 — eliminate the duplicate algorithm

`app/friends/[id]/page.tsx::getStreamingPattern` is deleted. The friend detail page calls a new endpoint `/api/friends/[id]/pattern` that runs `analyzePatterns` server-side using the same DB queries the panel route uses, with the broadcaster's TZ pulled from `Profile.timezone` (CP user) or defaulted to "UTC" for friends who are not Profiles. Returns the same shape as the panel `summary` field (no collabs — page has its own collabs section).

## Files affected

**New files:**

- `twitch-extension/src/lib/configSchema.ts` — parser + defaults (SPA).
- `lib/twitch/extensionConfigSchema.ts` — parser + defaults (backend, byte-identical to above).
- `twitch-extension/src/lib/configSchema.test.ts` — round-trip + invalid-input tests.
- `twitch-extension/src/components/SettingsForm.tsx` — the form.
- `app/api/friends/[id]/pattern/route.ts` — server-side endpoint replacing the in-page algorithm.
- `app/api/extension/channel/[channelId]/twitch-color/route.ts` — JWT-protected endpoint that returns the broadcaster's Twitch chat color for the "Use my Twitch profile color" button.

**Modified:**

- `twitch-extension/src/config.tsx` — keeps status strip, adds `<SettingsForm />` below it.
- `twitch-extension/src/panel.tsx` — reads config via Twitch helper, applies `showCollabs`/`showGame`/`cta` toggles, passes `tz` to backend.
- `twitch-extension/src/lib/api.ts` — adds `tz` query param.
- `twitch-extension/src/lib/types.ts` — schema rename + new fields.
- `twitch-extension/src/components/ScheduleSummary.tsx` — renders `medianHour` in `tz` with a short TZ label.
- `lib/scheduling/patterns.ts` — TZ-aware binning, start-only weight, signature change.
- `lib/twitch/extensionPredictions.ts` — schema rename + `tz` passthrough.
- `lib/twitch/extensionPredictions.test.ts` — new TZ-sensitivity cases.
- `app/api/extension/channel/[channelId]/panel/route.ts` — reads `?tz=…`, validates, passes to `analyzePatterns`.
- `app/friends/[id]/page.tsx` — deletes local `getStreamingPattern`, swaps to SWR on `/api/friends/[id]/pattern`.

**Twitch dev console** (manual, documented in README):

- Capabilities → Configuration method → "Extension Configuration Service".
- Bump version to 0.2.0 (Capabilities changes require demote to Local Test, re-upload, re-promote per Twitch lifecycle).
- Re-upload the zip.

## Testing

- **Unit:** `parseConfig` round-trips a full config, returns defaults for `null` / `""` / bad JSON / `{v: 2}` / missing fields, validates `tz`, rejects non-https `cta.url`, rejects malformed `accentColor`.
- **Unit:** `analyzePatterns` against a fixture of 31 sessions (matching the production user's data): asserts `topDays === ["Sun","Mon","Wed"]` and `medianHour === 19` for `America/New_York`, and asserts the output shifts as expected for `UTC` and `Asia/Tokyo`.
- **Integration:** `/api/extension/channel/[id]/panel?tz=America/New_York` returns a response whose `summary.tz === "America/New_York"`.
- **Integration:** `/api/friends/[id]/pattern` returns the same shape as the panel summary, given the same Friend.
- **Manual:** the Twitch panel renders correct days/hours after the broadcaster sets their TZ on the config page; toggling `showCollabs`/`showGame` updates the panel after refresh; custom CTA renders when set.

## Migration / rollout

- New extension version `0.2.0`. Existing `0.1.0` keeps working (Twitch Config Service is unused there; backend still works because old SPA never sends `?tz=…`, backend falls back to UTC = current broken behavior).
- After `0.2.0` reaches Released, deprecate `0.1.0` per Twitch lifecycle (automatic on release).
- No data migration. Nothing was stored.

## Risks & open questions

- **5KB Twitch Config limit.** Current schema is <500 bytes. Plenty of headroom for v2 additions.
- **Forged `tz` query param.** Mitigated by the "only affects forger's own render" argument above. Worth a brief comment in the route handler.
- **`Intl.supportedValuesOf` browser support.** Available in all modern browsers from 2022+; Twitch iframe is Chromium so guaranteed. No polyfill needed.
- **Friend detail page becomes async.** The page currently renders pattern instantly from SWR data; now it needs a second fetch. Acceptable — friend detail already has multiple SWR calls. SWR's parallel fetching keeps perceived load time roughly the same.
- **Capability change forces a Local Test demote.** Per Twitch lifecycle docs (confirmed against `dev.twitch.tv/docs/extensions/life-cycle`), changing Capabilities requires demoting to Local Test, re-uploading, and re-promoting. Documented in the rollout step; no fix needed beyond awareness.
