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

## How to submit the extension to Twitch

### Step 1 — Create the extension

1. Go to [dev.twitch.tv/console/extensions](https://dev.twitch.tv/console/extensions) and click **Create Extension**.
2. Fill in:
   - **Name**: Collab Planner
   - **Version**: 0.0.1
   - **Extension Type**: Panel (only — uncheck Overlay and Component)
3. Click **Create Extension Version**.

### Step 2 — Configure capabilities

In the extension dashboard, go to the **Capabilities** tab:
- **Panel Viewer URL**: leave blank for now (you'll upload the asset in the next step)
- **Panel Height**: 300
- Check **Can Link External Content** (required since the panel fetches from our API and links to `collab.deutschmark.online`)

### Step 3 — Upload assets

1. In the **Asset Hosting** tab, click **Upload Assets**.
2. Upload `panel.html` from this folder.
3. After upload, Twitch will give you a hosted URL like `https://[extension-id].ext-twitch.tv/[extension-id]/[version]/panel.html`.
4. Back in **Capabilities**, set **Panel Viewer URL** to that hosted URL.

### Step 4 — Allowlist the API

In the **Capabilities** tab, under **Allowlisted Panel URLs**, add:
```
https://collab.deutschmark.online
```
This allows the iframe to fetch from our API and navigate to our site.

### Step 5 — Extension details (required for review)

In the **Details** tab, fill in:
- **Summary**: Show your stream schedule and planned collabs. Let viewers plan a collab with you in one click.
- **Description**: (expand on the summary — mention schedule display, collab events, the CTA button)
- **Category**: Productivity / Social
- **Screenshots**: Take a screenshot of the panel in testing mode showing the schedule and collabs sections
- **Contact email**: your email

### Step 6 — Test locally before submitting

1. In the extension dashboard, go to **Testing**.
2. Under **Panel Testing Base URI**, enter `https://localhost:8080`.
3. Serve the extension folder locally:
   ```
   npx serve twitch-extension --ssl
   ```
4. Click **Install on Channel** → choose **Local Test**.
5. Open your Twitch channel — the panel appears below the stream player.
6. Verify the schedule and collabs load correctly. Check browser devtools for any errors.

### Step 7 — Submit for review

1. Once testing looks good, go to **Status** → click **Submit for Review**.
2. Twitch's review team checks:
   - The panel loads without errors
   - No TOS violations (no gambling, adult content, misleading info)
   - Privacy policy / terms links (add these to your site if you don't have them)
   - The **Can Link External Content** usage is legitimate
3. Review typically takes **3–7 business days**.
4. You'll get an email when approved or if changes are requested.

### Step 8 — Go live

After approval:
1. In the extension dashboard, click **Release** to make it publicly available.
2. Activate it on your own channel: Twitch Dashboard → Extensions → find Collab Planner → **Activate**.
3. Share the extension with friends — they can add it from [twitch.tv/ext/collab-planner](https://www.twitch.tv/ext) once live.

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
https://collab.deutschmark.online/plan?addFriend=[streamerUsername]
```

The `/plan` canvas automatically reads the `addFriend` query param, pre-selects that streamer as a participant, and adds them as a friend if they aren't already in the viewer's friend list.
