# Collab Planner — Twitch Extension

A Twitch panel extension that shows a streamer's upcoming schedule, planned collabs, and a button for viewers to plan their own collab.

## Files

| File | Purpose |
|------|---------|
| `panel.html` | Self-contained panel UI (HTML + CSS + JS) |
| `manifest.json` | Extension metadata for Twitch Developer Console |

## API endpoints used

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/extension/streamer/[username]` | None (public) | Returns schedule segments (next 14 days), upcoming collab events (next 3), and streamer profile info |

Example response:
```json
{
  "found": true,
  "displayName": "StreamerName",
  "avatarUrl": "https://...",
  "channelColor": "#9147ff",
  "schedule": [
    { "title": "Just Chatting", "startTime": "2025-08-01T18:00:00.000Z", "endTime": "...", "isRecurring": true }
  ],
  "collabs": [
    { "title": "Collab Stream", "startTime": "2025-08-05T19:00:00.000Z", "endTime": "...", "gameName": "Minecraft" }
  ]
}
```

## How to create the extension on dev.twitch.tv

1. Go to [dev.twitch.tv/console/extensions](https://dev.twitch.tv/console/extensions) and click **Create Extension**.
2. Fill in:
   - **Name**: Collab Planner
   - **Extension Type**: Panel
3. In the **Capabilities** tab, set:
   - **Panel Viewer Path**: `panel.html`
   - **Panel Height**: 300
4. In the **Asset Hosting** tab, upload `panel.html` (and any referenced assets).  
   Alternatively, during development you can use a locally served URL and set it as the panel URL.
5. In the **Allowlist** section, add:
   - `https://collab.deutschmark.online/api/extension/*`

## How to host panel.html

Option A — **Twitch-hosted assets** (simplest):  
Upload `panel.html` via the Twitch Developer Console asset uploader. Twitch hosts it at a CDN URL automatically.

Option B — **Self-hosted**:  
Serve `panel.html` from your own domain (must be HTTPS). Set the panel viewer URL in the Twitch Developer Console to point to your hosted file.

> The panel fetches data from `https://collab.deutschmark.online/api/extension/streamer/[username]`.  
> CORS headers (`Access-Control-Allow-Origin: *`) are already set on this endpoint.

## How to test locally

1. In the Twitch Developer Console, go to your extension's **Testing** page.
2. Set the **Panel Testing Base URI** to `https://localhost:8080` (or whichever port you use).
3. Serve the `twitch-extension/` folder locally with HTTPS, e.g.:
   ```
   npx serve twitch-extension --ssl
   ```
4. Install the extension on your own channel in **Local Test** mode.
5. Open your Twitch channel — the panel appears below the stream player.

> **Note**: `window.Twitch.ext.onContext` provides `ctx.channel` (the streamer's login name) which is used to call our API. This only works inside the Twitch iframe environment. Direct browser testing won't have this context.

## "Plan a collab" button

The CTA button links to:
```
https://collab.deutschmark.online/events/new?addFriend=[streamerUsername]
```

The `events/new` page automatically reads the `addFriend` query param, pre-selects that streamer as a participant, and adds them as a friend if they aren't already in the viewer's friend list.
