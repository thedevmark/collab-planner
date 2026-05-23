# Collab Planner — Twitch Panel Extension

**Date:** 2026-05-23
**Status:** Approved design, ready for implementation plan
**Type:** Net-new product surface (Twitch Extension distributing Collab Planner)

---

## Goal

Ship a Twitch Panel Extension that surfaces the streamer's **most likely upcoming live times** (computed by Collab Planner's VOD pattern analysis) on their Twitch channel page, plus any **scheduled collabs**. Every viewer of any channel that installs the extension gets useful information immediately — no Collab Planner account required on either side.

A secondary goal is **driving traffic to `collab.deutschmark.online`** for user acquisition, achieved through a single policy-compliant `Powered by Collab Planner ↗` footer link and a higher-intent CTA inside the broadcaster-only config view.

## Non-goals (v1)

- Video component / video overlay / mobile surfaces
- Viewer write actions: no "set reminder," no "suggest a collab," no voting
- Twitch identity sharing from viewers
- Bits, monetization, sponsorship
- Settings UI in the config view (config is status-only)

---

## Surfaces

Single Twitch extension type: **Panel** (~318px wide, channel page, on/offline).

A **Config view** also ships because Twitch requires one for any extension, but it is status-only — no broadcaster configuration is needed because the system auto-links via Twitch user ID.

---

## Panel UX

### Layout (connected channel)

```
┌─────────────────────────────────────┐
│  Likely upcoming streams            │  header
│  ─────────────────────────────────  │
│  Tue   7:00 pm   ~3h   ★★★          │  predicted slot
│  Wed   7:30 pm   ~3h   Scheduled    │  posted Twitch slot (overrides prediction)
│  Thu   8:00 pm   ~4h   ★★★          │
│  Sat   6:00 pm   ~5h   ★★★          │
│  Sun   6:00 pm   ~4h   ★★☆          │
│                                     │
│  Upcoming collabs                   │  conditional — only renders if any
│  ─────────────────────────────────  │
│  Sat  6 pm · with @alice @bob       │
│  Apex Legends                       │
│                                     │
│  ─────────────────────────────────  │
│  Powered by Collab Planner ↗        │  footer (always)
└─────────────────────────────────────┘
```

### Layout (no VOD data for this channel)

Same shell, with one swap: instead of the predictions list, a single line — *"No recent broadcast data to analyze yet."* Footer remains.

This is the only true empty state. Every channel with any recent VODs gets predictions, even if the broadcaster has never heard of Collab Planner (see "Two tiers" below).

### Visual treatment

- "Scheduled" badge replaces the star confidence rating when a predicted slot lines up with the streamer's posted Twitch schedule.
- Confidence is rendered as three stars: filled / half / empty.
- Times shown in the *viewer's* local timezone, resolved via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Day labels and time formatting follow the locale string from `Twitch.ext.onAuthorized`'s `clientLanguage` (falls back to `navigator.language`).
- Co-streamer chips in the collabs section link to that streamer's Twitch channel (in-Twitch link, no off-site indicator needed).
- Footer link carries the `↗` glyph and opens `collab.deutschmark.online/?utm_source=twitch_ext&utm_medium=panel_footer` in a new tab.

---

## Data architecture

### Two tiers — both produce a panel

| Tier | Trigger | Source | Cache TTL |
|---|---|---|---|
| **Connected** | broadcaster's `twitchId` matches a CP user row | Existing precomputed predictions from CP DB + scheduled collabs + posted Twitch schedule | 15 min server-side |
| **Unconnected** | no CP user row for that `twitchId` | On-demand: Helix VOD fetch → `lib/scheduling/` analysis → cached result; no collabs section | 24 h server-side |

### Auth flow

1. Panel iframe loads. Twitch SDK invokes `Twitch.ext.onAuthorized(auth)` and provides a JWT containing `channel_id` (the channel the panel is rendering on) and `user_id` (opaque — we do not request identity share).
2. Panel calls `GET https://collab.deutschmark.online/api/extension/channel/:channelId/panel` with `Authorization: Bearer <jwt>`.
3. Backend verifies the JWT signature against `TWITCH_EXTENSION_SECRET` and confirms the JWT's `channel_id` matches the URL path's `:channelId`.
4. Backend chooses tier:
   - **Connected** → return cached/freshly-computed connected response.
   - **Unconnected** → check `ExtensionPredictionCache` table by `twitchId`. Hit → return. Miss → enqueue analysis, return `{ status: "warming" }`. Panel shows "Analyzing recent broadcasts…" and retries once after ~5s.

### Response shape

```ts
type PanelResponse =
  | {
      status: "ok";
      predictions: Array<{
        day: string;          // viewer-locale day label, e.g. "Tue"
        startsAt: string;     // ISO 8601, viewer renders in local tz
        durationHours: number;
        confidence: 1 | 2 | 3;
        isPosted: boolean;    // true → render as "Scheduled" badge
      }>;
      collabs: Array<{
        startsAt: string;
        gameName: string | null;
        partners: Array<{ username: string; displayName: string; avatarUrl: string }>;
      }>;
      generatedAt: string;
    }
  | { status: "warming" }
  | { status: "no_data" };    // no VOD history available at all
```

### Backend additions

- `app/api/extension/channel/[channelId]/panel/route.ts` — new route, the only endpoint the extension hits.
- `lib/twitch/extension-jwt.ts` — JWT verification using `TWITCH_EXTENSION_SECRET` (HS256, base64-decoded per Twitch docs).
- `lib/twitch/extension-predictions.ts` — shared shaper that calls existing `lib/scheduling/` for both connected and unconnected paths.
- New Prisma model: `ExtensionPredictionCache { twitchId String @id, payload Json?, computedAt DateTime, expiresAt DateTime }` for the unconnected tier. `payload` is nullable so a sentinel row can mark "analysis in flight" — see Caching section.
- New env: `TWITCH_EXTENSION_SECRET`, `TWITCH_EXTENSION_CLIENT_ID`.

### Caching

- `Cache-Control: public, s-maxage=900, stale-while-revalidate=60` for connected responses.
- `Cache-Control: public, s-maxage=86400, stale-while-revalidate=300` for unconnected.
- Cold-analysis debounce uses the `ExtensionPredictionCache` row itself: before kicking off Helix work, the route INSERTs a sentinel row with `payload = null` and `expiresAt = now + 60s`. Concurrent requests that see a sentinel return `{ status: "warming" }` instead of starting a second analysis. On completion, the sentinel is overwritten with the real payload and the full 24h TTL. This works correctly across serverless instances since the lock lives in Postgres.

### Rate-limit posture

- Twitch Helix calls for unconnected analysis use the app-level CP Helix client (existing). If global Helix budget tightens, the unconnected tier can be gated behind a feature flag and the panel falls back to `no_data`.

---

## Config view

Broadcaster-only iframe rendered in the Twitch Extension Manager dashboard.

| State | Renders |
|---|---|
| Not in CP | "Your channel has no Collab Planner account yet. Sign in with Twitch at collab.deutschmark.online — your panel will start working automatically." + button: `Sign in with Twitch ↗` |
| In CP, analysis warming | "Account detected ✓. Analyzing your recent broadcasts — panel will populate within a few minutes." |
| Fully connected | "Account detected ✓. N predicted slots, M upcoming collabs." + button: `Open dashboard ↗` |

All outbound buttons carry `?utm_source=twitch_ext&utm_medium=config_view&utm_campaign=<state>`.

---

## Twitch policy compliance

Cross-checked against [Twitch Extension Guidelines & Policies](https://dev.twitch.tv/docs/extensions/guidelines-and-policies/). Resolutions:

- **"Off-site links may not deliver functionality similar to Twitch.tv"** — predicted schedule is derived from VOD pattern analysis Twitch does not offer; collab planning is non-overlapping with native Twitch features.
- **"Encouraging or rewarding users for taking actions outside Twitch must not be a principal use case"** — primary content is the predictions list (viewer-useful info). The single footer link uses the explicitly-allowed "powered by X" branding pattern. Empty state does NOT pivot to a hard CTA.
- **"Off-site links require a visible off-site indicator"** — all outbound links use the `↗` glyph and open in a new tab.
- **"No advertising or sponsorship content"** — no third-party content; CTA is first-party branding only.
- **"Extensions may not allow end users to publish content unless Twitch ID is granted"** — no viewer writes in v1; viewer is anonymous (`opaque` user_id only).
- **"Description must accurately describe functionality"** — submission description is literal.
- **"JavaScript must be human-readable; all fetch URLs declared"** — bundle ships unminified (or with sourcemaps). Single declared origin: `https://collab.deutschmark.online`.
- **"No iframes inside extensions"** — none; data is JSON over fetch.
- **"AJAX data must not be injected into the DOM without validation"** — all rendering via React text interpolation; no `dangerouslySetInnerHTML`, no `innerHTML`.
- **"Extension Helper script loaded first"** — `<script src="https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js">` is the first `<script>` in `panel.html` and `config.html`.
- **"Must load and configure without error on review channel"** — review checklist below.
- **"No Twitch branding/logos in extension content"** — no Twitch wordmark or emotes anywhere in panel UI.
- **NFTs / Bits / wagering / sponsorship** — none.

---

## Repository structure

The extension is a standalone static SPA — Twitch hosts the bundle on its own CDN once we upload a zip. It lives alongside the main Next.js app but builds independently.

```
collab-planner/
├── app/api/extension/channel/[channelId]/panel/route.ts   NEW backend endpoint
├── lib/twitch/extension-jwt.ts                            NEW JWT verify
├── lib/twitch/extension-predictions.ts                    NEW shaper
├── prisma/schema.prisma                                   add ExtensionPredictionCache
└── twitch-extension/                                      NEW — separate npm workspace
    ├── package.json                                       (vite, react, typescript)
    ├── vite.config.ts                                     two entries: panel, config
    ├── tsconfig.json
    ├── src/
    │   ├── panel.tsx
    │   ├── config.tsx
    │   ├── lib/
    │   │   ├── twitchExt.ts        wraps window.Twitch.ext
    │   │   ├── api.ts              fetch wrapper with JWT
    │   │   └── format.ts           viewer-local time/day formatters
    │   └── components/
    │       ├── PredictionsList.tsx
    │       ├── CollabsList.tsx
    │       └── PoweredByFooter.tsx
    ├── public/
    │   ├── panel.html              Helper script first
    │   └── config.html             Helper script first
    └── README.md                   build, zip, submission instructions
```

`twitch-extension/` builds with `vite build` to `dist/`. A `npm run package` script zips `dist/` for upload to the Twitch Extension dashboard.

---

## Testing

### Unit
- `lib/twitch/extension-jwt.ts` — JWT verification: valid, expired, wrong-secret, channel_id mismatch.
- `lib/twitch/extension-predictions.ts` — shape correctness for connected vs unconnected vs warming vs no_data tiers.
- `twitch-extension/src/lib/format.ts` — locale/timezone rendering.

### Integration
- `/api/extension/channel/:channelId/panel` end-to-end against a seeded CP user (connected tier) and a synthesized Helix response (unconnected tier).

### Manual / panel smoke test
- Twitch provides a local "Rig" for testing extensions in a fake channel. Document the Rig commands in `twitch-extension/README.md`. Smoke checklist:
  1. Panel loads with valid JWT, renders predictions for a connected test channel.
  2. Panel loads on an unconnected test channel, shows "Analyzing…" then populates.
  3. Empty state renders for a brand-new channel with zero VODs.
  4. Footer link opens correct UTM-tagged URL in a new tab.
  5. Config view renders all three broadcaster states.

### Review-submission checklist
- Review test channel: a CP-connected channel with VOD history, live during the review window.
- Testing instructions provided in the submission form: "Open the channel page; the panel should populate within 5 seconds with a predictions list and a footer link."
- Description copy is literal and lists every fetch URL.

---

## Deferred for v2+

- Set-reminder feature (browser notification or .ics)
- Friends-of-the-channel grid
- Viewer "suggest a collab" voting
- Video component / overlay surfaces
- Mobile surface
- Broadcaster config knobs (toggle collabs section, choose N predictions, etc.)
- Identity-share viewer experience (personalized: "this streamer matches your live hours")

---

## Open questions

None — design is approved and policy-compliant.
