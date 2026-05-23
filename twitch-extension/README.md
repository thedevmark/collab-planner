# Collab Planner — Twitch Panel Extension

Static SPA shipped to the Twitch Extension dashboard. Talks to the main Collab
Planner backend at `collab.deutschmark.online` for prediction data.

## Local development

```bash
npm install
npm run dev        # serves panel.html / config.html via vite dev server
```

Open `http://localhost:5173/panel.html` to preview. The Twitch Helper script
won't authorize outside the Twitch Developer Rig, so JWT-dependent code will
hang at "Loading…" — that's expected.

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
