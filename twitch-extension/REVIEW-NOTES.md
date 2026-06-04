# Schedule Forecast — Reviewer Walkthrough & Change Log

Paste this into the **Review Instructions / Walkthrough Guide** field when resubmitting
the extension in the Twitch Developer Console. Replace every «PLACEHOLDER» first.

---

## What this Extension does (30-second version)

**Schedule Forecast** predicts when *this channel* will next go live, based on the
channel's own Twitch broadcast history. It renders a "next stream likely…" hero line
plus a 7-day calendar of the channel's typical stream days and times.

**There is no setup.** The forecast builds automatically from the channel's past
broadcasts (VODs) the moment the panel loads. The broadcaster never has to enter
schedule data by hand. The config page only offers cosmetic options (timezone display,
12/24h clock, week start, theme, accent color).

---

## ⚠️ Why the previous review saw an empty panel (please read)

The forecast is computed from **the Twitch channel's own broadcast history.** The panel
queries our backend with the channel ID from the extension JWT, then analyzes that
channel's recent VODs.

- A **brand-new channel with zero past broadcasts** will correctly show an empty /
  "warming" state. That is expected behavior, not a malfunction — there is simply no
  history to forecast from yet.
- Streams created on our website (`collab.deutschmark.online`) belong to a *website
  account*. They only feed the panel for the **matching Twitch channel** — i.e. the
  Twitch account whose channel the extension is installed on must be the same account
  that owns those streams.

**To see the Extension working, test on the account below.** It already has broadcast
history (and a linked website account), so the panel populates immediately.

---

## Test account (already set up for review)

| Field | Value |
|-------|-------|
| Twitch username | «TEST_TWITCH_USERNAME» |
| Twitch email | «TEST_TWITCH_EMAIL» |
| Twitch password | «TEST_TWITCH_PASSWORD» |
| Collab Planner site account | linked to the same Twitch login (sign in with Twitch at `collab.deutschmark.online`) |

This channel has the extension **pre-activated** as a panel and has real broadcast
history, so no configuration is required to see populated data.

> The Extension does **not** require the channel to be live during review. Panels render
> on the channel's offline/About page too. (A live indicator does appear *if* the channel
> happens to be streaming, but it is not needed to verify functionality.)

---

## Step-by-step test procedure

1. Log into Twitch as **«TEST_TWITCH_USERNAME»** (credentials above).
2. Open **https://www.twitch.tv/«TEST_TWITCH_USERNAME»**.
3. Scroll **below the video player** to the panel area.
4. Within ~5 seconds the **Schedule Forecast** panel renders and shows:
   - a hero line predicting the next likely stream (e.g. *"Next stream likely Wed around 7 PM"*),
   - a 7-day calendar/heatmap of the channel's typical stream days and times,
   - a "Powered by Collab Planner" footer that opens `collab.deutschmark.online` in a new tab.
5. **Config view:** Creator Dashboard → Extensions → Schedule Forecast → **Configure**.
   - The status card reads **"Collab Planner ✓ — Account detected. Streams <days>."**
   - Change any cosmetic setting and click **Save** → a **"Saved ✓"** confirmation appears.
   - Reload the panel to confirm the setting persisted (e.g. 24-hour clock).

### What "working" looks like vs. what it is not

The panel shows a **forecast** — the channel's *typical* days/times — not a literal list
of individual upcoming stream entries. Posted schedule slots and past broadcasts both
feed the prediction, but the output is a pattern ("usually Mon/Wed/Sat around 7 PM"),
by design. "One thing, done well."

---

## Backend / allowlist information

- **EBS:** `https://collab.deutschmark.online`
- **Allowlisted fetch URL:** `https://collab.deutschmark.online/api/extension/channel/*`
- **Allowlisted link URL:** `https://collab.deutschmark.online/`
- The panel authenticates every request with the signed Twitch Extension JWT
  (`Authorization: Bearer <token>`); the backend verifies it with the extension secret
  before returning any data.

---

## Change log for this resubmission

- **4.4 — Advertising removed.** The screenshot containing a website advert
  (former store image #3) has been removed from the Extension's store assets.
- **1.3 — Clarity.** Added these reviewer testing instructions with a pre-configured
  test account, and clarified in the store description that the forecast is built
  automatically from the channel's Twitch broadcast history (no manual setup).

---

## Developer availability

Available for live review **«DAYS / TIME WINDOW, e.g. Mon–Fri 9 AM–5 PM PT»**.
Contact: «EMAIL» (the address on file for this Extension).
