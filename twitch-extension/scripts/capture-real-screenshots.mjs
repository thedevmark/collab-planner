// Capture the actual panel UI via headless Chromium against the running
// dev server. Way more accurate than maintaining hand-drawn SVG mockups
// that drift from the live design after every iteration.
//
// Prereqs: dev server running at https://localhost:5174 (`npm run dev`).
//
// Outputs:
//   assets/_capture-panel-ok.png    — schedule state (Tomorrow / Wednesday)
//   assets/_capture-panel-live.png  — live now state
//   assets/_capture-panel-warming.png — warming/loading state
//   assets/screenshot-1-overview.png  — composite hero: panel on right + caption left
//   assets/screenshot-2-anatomy.png   — bigger panel with feature callouts
//   assets/screenshot-3-config.png    — config view capture

import puppeteer from "puppeteer";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const outDir = path.resolve(here, "..", "assets");
mkdirSync(outDir, { recursive: true });

const interDir = path.join(repoRoot, "node_modules/@fontsource/inter/files");
const interFonts = [400, 500, 600, 700, 800].map((w) =>
  readFileSync(path.join(interDir, `inter-latin-${w}-normal.woff2`))
);

const DEV_BASE = "https://localhost:5174";
const PANEL_W = 318;
// Tall viewport so flex auto-margin doesn't have anywhere to expand —
// we'll override the auto-margin via injected CSS so the footer sits
// right under the calendar, then capture only the actual content
// height via fullPage. No more dead space below the time axis.
const PANEL_H = 900;

console.log("Launching headless browser …");
const browser = await puppeteer.launch({
  headless: true,
  args: ["--ignore-certificate-errors"],
});

// CSS injected before screenshot to (a) override the flex auto-margin
// that pushes the footer to bottom of viewport with a giant gap above,
// and (b) constrain the body to natural content height. After this the
// panel renders as a tight stack: schedule → calendar → footer with
// only the explicit margins between them. Perfect for marketing shots.
const KILL_AUTOMARGIN_CSS = `
  body { height: auto !important; min-height: 0 !important; }
  #root { flex: 0 0 auto !important; }
  .powered-by { margin-top: 8px !important; padding-top: 4px !important; }
  .weekcal { margin-top: 4px !important; padding-top: 6px !important; }
  .weekcal-thin-bar { margin-top: 6px !important; }
`;

// Each screenshot showcases a different broadcaster's accent color
// choice — drives home the "your color cascades through everything"
// customization story.
const ACCENT_FOR_SHOT = {
  ok: "#00c8af",      // teal — screenshot-1 (thedeutschmark)
  live: "#ff4d8a",    // hot pink — screenshot-2 (a1exzandra)
  warming: "#3b82f6", // professional blue — screenshot-3 (config view)
};
function accentOverride(color) {
  return `:root { --accent: ${color} !important; }`;
}

/** Fake the system clock so screenshots are deterministic AND so the
 *  NOW cursor lands inside an active stream window. Without this the
 *  cursor only appears if you happen to capture during a streamer's
 *  typical broadcast window. */
async function fakeTime(page, isoString) {
  const fakeMs = new Date(isoString).getTime();
  await page.evaluateOnNewDocument((ms) => {
    const RealDate = Date;
    class FakeDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(ms);
        // @ts-ignore — pass through original Date constructor args
        else super(...args);
      }
      static now() { return ms; }
    }
    // @ts-ignore — swap global Date
    globalThis.Date = FakeDate;
  }, fakeMs);
}

async function capturePanel(previewMode, outName, accent, fakeNowIso) {
  const page = await browser.newPage();
  if (fakeNowIso) await fakeTime(page, fakeNowIso);
  await page.setViewport({ width: PANEL_W, height: PANEL_H, deviceScaleFactor: 2 });
  await page.goto(`${DEV_BASE}/panel.html?preview=${previewMode}`, { waitUntil: "networkidle0" });
  // Override layout + accent color before capture.
  await page.addStyleTag({ content: KILL_AUTOMARGIN_CSS });
  if (accent) await page.addStyleTag({ content: accentOverride(accent) });
  // Give the panel a beat for fonts + the style override to apply.
  await new Promise((r) => setTimeout(r, 1200));
  // Measure the actual content height so we don't capture trailing
  // background — fullPage would do this but doesn't always respect
  // `body { height: auto }`. Manual measure is reliable.
  const contentHeight = await page.evaluate(() => {
    const root = document.getElementById("root");
    return root ? Math.ceil(root.getBoundingClientRect().bottom) : document.body.scrollHeight;
  });
  await page.setViewport({ width: PANEL_W, height: contentHeight, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 200));
  const buf = await page.screenshot({ type: "png", omitBackground: false });
  writeFileSync(path.join(outDir, outName), buf);
  console.log(`wrote ${outName} (${PANEL_W}x${contentHeight} @2x — measured natural content)`);
  await page.close();
  return { buf, width: PANEL_W, height: contentHeight };
}

async function captureConfig(outName, accent) {
  const page = await browser.newPage();
  await page.setViewport({ width: 380, height: 900, deviceScaleFactor: 2 });
  // Pass the accent through the URL so the SettingsForm's hex input,
  // color picker, and saved-state swatch all reflect the same color
  // as the rest of the panel — no purple/blue mismatch in the capture.
  const accentParam = accent ? `&accent=${encodeURIComponent(accent)}` : "";
  await page.goto(`${DEV_BASE}/config.html?preview=connected${accentParam}`, { waitUntil: "networkidle0" });
  // Same layout-tightening as panel captures — without this, #root
  // has flex: 1 and stretches to the full 900px viewport so the
  // "natural" height measurement returns 900px of stretched body
  // instead of the actual ~500px of form content.
  await page.addStyleTag({ content: KILL_AUTOMARGIN_CSS });
  // Marketing capture only — hide the "Collab Planner ✓ Account
  // detected ..." status strip so the screenshot leads straight into
  // the settings form (Timezone first). The component still ships
  // in the real config view; this is a screenshot-only suppression.
  await page.addStyleTag({ content: `
    .status-strip-wrap { display: none !important; height: 0 !important; margin: 0 !important; padding: 0 !important; }
    .settings-form { padding-top: 0 !important; margin-top: 0 !important; gap: 14px !important; }
    .settings-form > label:first-child, .settings-form > fieldset:first-child { margin-top: 0 !important; padding-top: 0 !important; }
  ` });
  if (accent) await page.addStyleTag({ content: accentOverride(accent) });
  await new Promise((r) => setTimeout(r, 1200));
  const contentHeight = await page.evaluate(() => {
    const root = document.getElementById("root");
    return root ? Math.ceil(root.getBoundingClientRect().bottom) : document.body.scrollHeight;
  });
  // Find the y-center of the 5 settings we want to annotate. These get
  // used by screenshot-2-config.png to draw textbook-style connector
  // lines from each form row to its labelled bullet on the right.
  const fieldData = await page.evaluate(() => {
    const wanted = ["Timezone", "24-hour", "Start week", "Theme", "Accent"];
    const all = Array.from(document.querySelectorAll(".settings-form > label, .settings-form > fieldset"));
    return wanted.map((needle) => {
      const el = all.find((e) => (e.textContent || "").toLowerCase().includes(needle.toLowerCase()));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { needle, top: r.top, bottom: r.bottom, center: (r.top + r.bottom) / 2 };
    }).filter(Boolean);
  });
  await page.setViewport({ width: 380, height: contentHeight, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 200));
  const buf = await page.screenshot({ type: "png", omitBackground: false });
  writeFileSync(path.join(outDir, outName), buf);
  console.log(`wrote ${outName} (380x${contentHeight} @2x — measured natural content)`);
  await page.close();
  return { buf, width: 380, height: contentHeight, fieldData };
}

// ── Capture raw panel states (one per accent color) ─────────────
// screenshot-1 uses panelOk(teal), screenshot-2 uses panelOkAmber,
// screenshot-3 uses configCapture(violet) — three distinct accent
// colors across the marketing kit so it shows the customization range.
// Fake "now" for each capture so the NOW cursor lands inside an
// active stream window. Both reference dates are picked to land on
// the streamer's typical day at mid-window.
// thedeutschmark streams Mon/Wed/Sat ~7:30 PM EDT → for the marketing
//   live state we fake Mon 10 PM EDT so the stream is exactly halfway
//   through its 5h typical window (2.5h elapsed mock startedAt below).
// a1exzandra (mock 2) streams Mon/Thu/Sat ~5:30 PM EDT → fake Tue 3 PM
//   EDT (an off day) so the white "now" cursor sits in a clean gap
//   between sessions — no live bar, just the neutral now marker.
// Odd minute offsets so the live bar doesn't end on a tidy round hour
// (looked too perfect / staged on the marketing shot).
const FAKE_NOW_LIVE = "2026-05-26T02:17:00Z"; // Mon 10:17 PM EDT
const FAKE_NOW_OK2 = "2026-05-27T19:00:00Z";  // Tue 3:00 PM EDT

// Screenshot 1 hero: the LIVE state, halfway through the stream — shows
// off the red LIVE NOW bar and red cursor against a populated panel.
const panelOk = await capturePanel("live", "_capture-panel-live.png", ACCENT_FOR_SHOT.ok, FAKE_NOW_LIVE);
// Screenshot 2: a DIFFERENT streamer in the regular schedule state —
// Mon/Thu/Sat 5:30 PM. Shows variety: different days, different time,
// different name, not currently live.
const panelOkAnatomy = await capturePanel("ok2", "_capture-panel-ok2-pink.png", ACCENT_FOR_SHOT.live, FAKE_NOW_OK2);
await capturePanel("warming", "_capture-panel-warming.png", ACCENT_FOR_SHOT.warming);
const configCapture = await captureConfig("_capture-config.png", ACCENT_FOR_SHOT.warming);

// Aspect ratio of the trimmed capture — used so the marketing display
// sizes preserve real proportions instead of stretching.
const panelAspect = panelOk.width / panelOk.height;
const configAspect = configCapture.width / configCapture.height;

await browser.close();
console.log("Browser closed.");

// ── Compose marketing screenshots ─────────────────────────────────
// Same orby dark background as the design slideshow.

const SLIDE_DEFS = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#0d0518"/>
    <stop offset="100%" stop-color="#0a1822"/>
  </linearGradient>
  <radialGradient id="orb-cyan" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0%" stop-color="#2ec4b6" stop-opacity="0.20"/>
    <stop offset="60%" stop-color="#2ec4b6" stop-opacity="0.05"/>
    <stop offset="100%" stop-color="#2ec4b6" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="orb-blue" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0%" stop-color="#1D4470" stop-opacity="0.18"/>
    <stop offset="60%" stop-color="#1D4470" stop-opacity="0.05"/>
    <stop offset="100%" stop-color="#1D4470" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="orb-purple" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0%" stop-color="#9147ff" stop-opacity="0.10"/>
    <stop offset="60%" stop-color="#9147ff" stop-opacity="0.025"/>
    <stop offset="100%" stop-color="#9147ff" stop-opacity="0"/>
  </radialGradient>
`;

function bg(w, h) {
  return `<rect width="${w}" height="${h}" fill="url(#bg)"/>
  <ellipse cx="${w * 0.85}" cy="${h * 0.2}" rx="${w * 0.35}" ry="${h * 0.5}" fill="url(#orb-cyan)"/>
  <ellipse cx="${w * 0.15}" cy="${h * 0.85}" rx="${w * 0.35}" ry="${h * 0.45}" fill="url(#orb-blue)"/>
  <ellipse cx="${w * 0.6}" cy="${h * 0.3}" rx="${w * 0.25}" ry="${h * 0.3}" fill="url(#orb-purple)"/>`;
}

/** Round the corners of a PNG buffer by compositing it through a
 *  rounded-rect alpha mask. Keeps the panel screenshot visually
 *  consistent with the SVG plate behind it (rx=6). */
async function roundPanelCorners(buf, radius = 10) {
  const meta = await sharp(buf).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
  );
  return sharp(buf).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

function renderSvgWithPanelComposite(svg, panelBuf, panelX, panelY, panelW, panelH, outPath) {
  // Render the SVG background with a transparent "hole" where the panel goes.
  // Resvg renders, then sharp composites the real panel screenshot on top.
  const png = new Resvg(svg, {
    font: { fontBuffers: interFonts, defaultFontFamily: "Segoe UI", loadSystemFonts: true },
  }).render().asPng();
  // Resize the panel to target width while preserving aspect.
  return sharp(png)
    .composite([
      {
        input: panelBuf,
        top: panelY,
        left: panelX,
      },
    ])
    .png()
    .toFile(outPath);
}

// ── Screenshot 1: combined hero ─────────────────────────────────────
// One image showing BOTH panels (live state on left, schedule state on
// right) side-by-side at the bottom, with summary headline + subtitle +
// bullets at the top. Replaces the two-shot split (overview + anatomy)
// with a single, denser marketing card.
const SHOT_W = 1024;
const SHOT_H = 768;

const COMBO_PANEL_W = 300;
const COMBO_PANEL_H = Math.round(COMBO_PANEL_W / panelAspect);
const COMBO_GAP = 120;
const COMBO_LEFT_MARGIN = Math.floor((SHOT_W - 2 * COMBO_PANEL_W - COMBO_GAP) / 2);
// Panels sit higher in the frame — closer to the subtitle — to leave
// a calm bottom margin instead of crowding the bottom edge.
const COMBO_PANEL_Y = 340;
const comboLeftX = COMBO_LEFT_MARGIN;
const comboRightX = COMBO_LEFT_MARGIN + COMBO_PANEL_W + COMBO_GAP;

const screenshot1Svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SHOT_W}" height="${SHOT_H}" viewBox="0 0 ${SHOT_W} ${SHOT_H}">
  <defs>${SLIDE_DEFS}
    <filter id="panel-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="10" stdDeviation="20" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>
  ${bg(SHOT_W, SHOT_H)}

  <g font-family="Inter, Segoe UI, sans-serif" fill="#efeff1" text-anchor="middle">
    <text x="${SHOT_W / 2}" y="135" font-size="92" font-weight="800" letter-spacing="-2.6">
      <tspan>Schedule </tspan><tspan fill="${ACCENT_FOR_SHOT.ok}">Forecast</tspan>
    </text>
    <text x="${SHOT_W / 2}" y="220" font-size="20" font-weight="500" fill="#adadb8">Most channels don't post a schedule – and the ones that do</text>
    <text x="${SHOT_W / 2}" y="246" font-size="20" font-weight="500" fill="#adadb8">often let it get outdated. <tspan font-weight="800" fill="#efeff1">Schedule Forecast</tspan> reads each streamer's</text>
    <text x="${SHOT_W / 2}" y="272" font-size="20" font-weight="500" fill="#adadb8">broadcast history to predict when they'll <tspan text-decoration="underline" fill="#efeff1">actually</tspan> go live next.</text>
  </g>
  <!-- Italic "a Twitch Extension" sits under the headline like a
       book subtitle — part of the title block, not a corner tag. -->
  <text x="${SHOT_W / 2}" y="170" font-family="Inter, Segoe UI, sans-serif" font-size="22" font-weight="500" font-style="italic" fill="#8c8c98" text-anchor="middle" letter-spacing="0.01em">a Twitch Extension</text>


  <!-- Panel shadow plates (real panels are composited on top via sharp) -->
  <rect x="${comboLeftX}" y="${COMBO_PANEL_Y}" width="${COMBO_PANEL_W}" height="${COMBO_PANEL_H}" rx="6" fill="#18181b" filter="url(#panel-shadow)"/>
  <rect x="${comboRightX}" y="${COMBO_PANEL_Y}" width="${COMBO_PANEL_W}" height="${COMBO_PANEL_H}" rx="6" fill="#18181b" filter="url(#panel-shadow)"/>
</svg>`;

const comboLivePanel = await roundPanelCorners(await sharp(panelOk.buf).resize(COMBO_PANEL_W, COMBO_PANEL_H).png().toBuffer());
const comboSchedulePanel = await roundPanelCorners(await sharp(panelOkAnatomy.buf).resize(COMBO_PANEL_W, COMBO_PANEL_H).png().toBuffer());
const combinedPng = new Resvg(screenshot1Svg, {
  font: { fontBuffers: interFonts, defaultFontFamily: "Segoe UI", loadSystemFonts: true },
}).render().asPng();
await sharp(combinedPng)
  .composite([
    { input: comboLivePanel, top: COMBO_PANEL_Y, left: comboLeftX },
    { input: comboSchedulePanel, top: COMBO_PANEL_Y, left: comboRightX },
  ])
  .png()
  .toFile(path.join(outDir, "screenshot-1-overview.png"));
console.log("wrote screenshot-1-overview.png (1024x768, combined)");

// ── Screenshot 2: config view with textbook-style connector lines ─
// Form on the LEFT, headline + 5 labels on the right. A thin
// connector line runs from each form-field row to its matching
// label — reads like a textbook annotation diagram.
const CFG_W = 290;
const CFG_H = Math.round(CFG_W / configAspect);
const cfgX = 80;
const cfgY = Math.floor((SHOT_H - CFG_H) / 2);

// Map the captured field y-centers (in capture pixels) to display
// pixels in the final marketing image. Scale factor = display_width /
// capture_width, applied to capture-y plus the card's top offset.
const fieldData = configCapture.fieldData || [];
const labelByNeedle = {
  Timezone: { name: "Timezone", desc: "match the streamer's local clock" },
  "24-hour": { name: "Time format", desc: "12-hour or 24-hour" },
  "Start week": { name: "First day of week", desc: "Sunday or Monday" },
  Theme: { name: "Theme", desc: "dark or light" },
  Accent: { name: "Accent color", desc: "Twitch profile, hex, or color picker" },
};
const lineEndX = 600;              // right end of each leader (dot + text anchor)
const lineLen = 113;               // half the previous full-width span
const lineStartX = lineEndX - lineLen;
const textStartX = lineEndX + 18;  // small gap, then the label text
// Leaders are decorative (detached from the form rows), sitting in the
// center-right of the frame — so the five labels get an even vertical
// rhythm centered against the card rather than each mapping to its
// captured field y.
const blockTop = 256;
const rowGap = 64;
const connectorRows = fieldData.map((f, i) => {
  const meta = labelByNeedle[f.needle] || { name: f.needle, desc: "" };
  return { y: blockTop + i * rowGap, name: meta.name, desc: meta.desc };
});

const screenshot3Svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SHOT_W}" height="${SHOT_H}" viewBox="0 0 ${SHOT_W} ${SHOT_H}">
  <defs>${SLIDE_DEFS}
    <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="18" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  ${bg(SHOT_W, SHOT_H)}

  <!-- Card plate (real form composited on top) -->
  <rect x="${cfgX}" y="${cfgY}" width="${CFG_W}" height="${CFG_H}" rx="6" fill="#18181b" filter="url(#card-shadow)"/>

  <!-- Headline sits above the form/lines so it doesn't clip the
       right edge. Smaller font, left-aligned so the lines below
       feel like an annotation diagram beneath the title. -->
  <g font-family="Inter, Segoe UI, sans-serif" fill="#efeff1">
    <text x="300" y="140"><tspan font-size="104" font-weight="800" letter-spacing="-3" fill="${ACCENT_FOR_SHOT.warming}">5</tspan><tspan font-size="46" font-weight="800" letter-spacing="-1.4" dx="14">settings.</tspan></text>
  </g>

  <!-- Connector lines + labels (one per field) -->
  ${connectorRows.map((row) => `
    <line x1="${lineStartX}" y1="${row.y}" x2="${lineEndX}" y2="${row.y}" stroke="${ACCENT_FOR_SHOT.warming}" stroke-width="1" stroke-opacity="0.55"/>
    <circle cx="${lineStartX}" cy="${row.y}" r="2.5" fill="${ACCENT_FOR_SHOT.warming}"/>
    <circle cx="${lineEndX}" cy="${row.y}" r="3" fill="${ACCENT_FOR_SHOT.warming}"/>
    <text x="${textStartX}" y="${row.y + 5}" font-family="Inter, Segoe UI, sans-serif" font-size="17" font-weight="500" fill="#efeff1"><tspan font-weight="700">${row.name}</tspan> — ${row.desc}</text>
  `).join("\n")}
</svg>`;

const configSized = await roundPanelCorners(await sharp(configCapture.buf).resize(CFG_W, CFG_H).png().toBuffer());
await renderSvgWithPanelComposite(
  screenshot3Svg,
  configSized,
  cfgX,
  cfgY,
  CFG_W,
  CFG_H,
  path.join(outDir, "screenshot-2-config.png")
);
console.log("wrote screenshot-2-config.png (1024x768)");

// ── Screenshot 3: "Hey, I'm Mark." — personal intro ────────────────
// Solo builder card. Avatar + name + bio + pull-quote + link. Same
// orby dark background language as the rest of the marketing kit;
// teal accent ties it to the Schedule Forecast hero slide.
const MARK_ACCENT = ACCENT_FOR_SHOT.ok;
const avatarUrl = "https://static-cdn.jtvnw.net/jtv_user_pictures/54c170ef-e1d0-463d-adda-922e751ef6b8-profile_image-300x300.png";
const avatarBuf = Buffer.from(await (await fetch(avatarUrl)).arrayBuffer());
const avatarDataUri = `data:image/png;base64,${avatarBuf.toString("base64")}`;

const introSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SHOT_W}" height="${SHOT_H}" viewBox="0 0 ${SHOT_W} ${SHOT_H}">
  <defs>${SLIDE_DEFS}
    <clipPath id="avatar-clip"><circle cx="120" cy="120" r="120"/></clipPath>
    <filter id="avatar-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="14"/>
      <feOffset dx="0" dy="10" result="off"/>
      <feFlood flood-color="#000" flood-opacity="0.55"/>
      <feComposite in2="off" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  ${bg(SHOT_W, SHOT_H)}

  <!-- Avatar (left column) -->
  <g transform="translate(80, 150)" filter="url(#avatar-shadow)">
    <image href="${avatarDataUri}" x="0" y="0" width="240" height="240" clip-path="url(#avatar-clip)"/>
  </g>

  <!-- Right column: name + bio. "beautiful" and "simple" get subtle
       differentiated text effects to give the line a textural feel,
       per the marketing brief — bold-accent vs italic-accent. -->
  <g font-family="Inter, Segoe UI, sans-serif" fill="#efeff1">
    <text x="380" y="195" font-size="60" font-weight="800" letter-spacing="-1.8">Hey, I'm Mark.</text>

    <text x="380" y="252" font-size="19" font-weight="500" fill="#adadb8">I stream over at <tspan font-weight="700" fill="#efeff1">twitch.tv/thedeutschmark</tspan>. I built</text>
    <text x="380" y="278" font-size="19" font-weight="500" fill="#adadb8">this because I wanted a <tspan font-weight="800" fill="${MARK_ACCENT}">beautiful</tspan>, <tspan font-style="italic" fill="${MARK_ACCENT}">simple</tspan> way</text>
    <text x="380" y="304" font-size="19" font-weight="500" fill="#adadb8">to display my schedule without micromanaging it</text>
    <text x="380" y="330" font-size="19" font-weight="500" fill="#adadb8">or forgetting to update.</text>

    <text x="380" y="368" font-size="19" font-weight="500" fill="#adadb8">Schedule Forecast is part of the stream toolset –</text>
    <text x="380" y="394" font-size="19" font-weight="500" fill="#adadb8">a free collection of overlays, widgets, and apps</text>
    <text x="380" y="420" font-size="19" font-weight="500" fill="#adadb8">for live streamers that I built.</text>
  </g>

  <!-- Big URL — the call-to-action -->
  <text x="${SHOT_W / 2}" y="570" font-family="Inter, Segoe UI, sans-serif" font-size="13" font-weight="700" fill="#6b6b75" text-anchor="middle" letter-spacing="0.16em">EXPLORE THE TOOLSET</text>
  <text x="${SHOT_W / 2}" y="655" font-family="Inter, Segoe UI, sans-serif" font-size="56" font-weight="800" fill="#efeff1" text-anchor="middle" letter-spacing="-1.4">toolset.deutschmark.online <tspan fill="${MARK_ACCENT}">↗</tspan></text>
</svg>`;

const introPng = new Resvg(introSvg, {
  font: { fontBuffers: interFonts, defaultFontFamily: "Segoe UI", loadSystemFonts: true },
}).render().asPng();
writeFileSync(path.join(outDir, "screenshot-3-mark.png"), introPng);
console.log("wrote screenshot-3-mark.png (1024x768)");

console.log("\nAll real-screenshot composites in twitch-extension/assets/");
