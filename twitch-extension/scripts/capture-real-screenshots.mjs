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
  .powered-by { margin-top: 18px !important; }
  .weekcal-thin-bar { margin-top: 12px !important; }
`;

// Each screenshot showcases a different broadcaster's accent color
// choice — drives home the "your color cascades through everything"
// customization story.
const ACCENT_FOR_SHOT = {
  ok: "#00c8af",      // teal — screenshot-1 (thedeutschmark)
  live: "#ff4d8a",    // hot pink — screenshot-2 (a1exzandra)
  warming: "#a855f7", // violet — screenshot-3 (config view)
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
  await page.goto(`${DEV_BASE}/config.html?preview=connected`, { waitUntil: "networkidle0" });
  // Same layout-tightening as panel captures — without this, #root
  // has flex: 1 and stretches to the full 900px viewport so the
  // "natural" height measurement returns 900px of stretched body
  // instead of the actual ~500px of form content.
  await page.addStyleTag({ content: KILL_AUTOMARGIN_CSS });
  if (accent) await page.addStyleTag({ content: accentOverride(accent) });
  await new Promise((r) => setTimeout(r, 1200));
  const contentHeight = await page.evaluate(() => {
    const root = document.getElementById("root");
    return root ? Math.ceil(root.getBoundingClientRect().bottom) : document.body.scrollHeight;
  });
  await page.setViewport({ width: 380, height: contentHeight, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 200));
  const buf = await page.screenshot({ type: "png", omitBackground: false });
  writeFileSync(path.join(outDir, outName), buf);
  console.log(`wrote ${outName} (380x${contentHeight} @2x — measured natural content)`);
  await page.close();
  return { buf, width: 380, height: contentHeight };
}

// ── Capture raw panel states (one per accent color) ─────────────
// screenshot-1 uses panelOk(teal), screenshot-2 uses panelOkAmber,
// screenshot-3 uses configCapture(violet) — three distinct accent
// colors across the marketing kit so it shows the customization range.
// Fake "now" for each capture so the NOW cursor lands inside an
// active stream window. Both reference dates are picked to land on
// the streamer's typical day at mid-window.
// thedeutschmark streams Mon/Wed/Sat ~7:30 PM EST → fake "now" = Mon 8 PM EST
// a1exzandra streams Wed/Fri/Sun ~2:30 PM EST → fake "now" = Wed 3 PM EST
const FAKE_NOW_OK = "2026-05-26T00:00:00Z"; // Mon 8 PM EDT
const FAKE_NOW_OK2 = "2026-05-27T19:00:00Z"; // Wed 3 PM EDT

const panelOk = await capturePanel("ok", "_capture-panel-ok.png", ACCENT_FOR_SHOT.ok, FAKE_NOW_OK);
// screenshot-2 uses a SECOND distinct streamer mock (a1exzandra,
// Wed/Fri/Sun at 2 PM) so the marketing kit shows the panel with
// different broadcaster contexts, not the same thedeutschmark twice.
const panelOkAnatomy = await capturePanel("ok2", "_capture-panel-ok2-pink.png", ACCENT_FOR_SHOT.live, FAKE_NOW_OK2);
await capturePanel("live", "_capture-panel-live.png", ACCENT_FOR_SHOT.live, FAKE_NOW_OK);
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

// ── 1. Screenshot 1: hero overview ──────────────────────────────────
// Left half: big "Schedule Forecast" caption + tagline + bullets
// Right half: real panel (ok state)
const SHOT_W = 1024;
const SHOT_H = 768;
// Display size derived from the actual measured capture aspect so the
// panel inside the marketing image is exactly as tall as its content.
// Fix the width, derive height from the real aspect ratio.
const PANEL_DISPLAY_W = 360;
const PANEL_DISPLAY_H = Math.round(PANEL_DISPLAY_W / panelAspect);
const panelX1 = SHOT_W - PANEL_DISPLAY_W - 80;
const panelY1 = Math.floor((SHOT_H - PANEL_DISPLAY_H) / 2);

const screenshot1Svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SHOT_W}" height="${SHOT_H}" viewBox="0 0 ${SHOT_W} ${SHOT_H}">
  <defs>${SLIDE_DEFS}
    <filter id="panel-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="10" stdDeviation="20" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>
  ${bg(SHOT_W, SHOT_H)}

  <!-- Left caption — denser, larger type, bullets fill the column -->
  <g font-family="Inter, Segoe UI, sans-serif" fill="#efeff1">
    <text x="80" y="140" font-size="72" font-weight="800" letter-spacing="-2.4">Schedule</text>
    <text x="80" y="216" font-size="72" font-weight="800" letter-spacing="-2.4" fill="${ACCENT_FOR_SHOT.ok}">Forecast</text>
    <text x="80" y="266" font-size="22" font-weight="500" fill="#adadb8">When this streamer is likely live —</text>
    <text x="80" y="296" font-size="22" font-weight="500" fill="#adadb8">predicted from real broadcast history.</text>

    <g font-size="17" fill="#efeff1" font-weight="500">
      <g transform="translate(80, 380)">
        <circle cx="6" cy="6" r="6" fill="${ACCENT_FOR_SHOT.ok}"/>
        <text x="26" y="11">Plain-English "Tomorrow at 7 PM" forecast</text>
      </g>
      <g transform="translate(80, 418)">
        <circle cx="6" cy="6" r="6" fill="${ACCENT_FOR_SHOT.ok}"/>
        <text x="26" y="11">Weekly calendar with live NOW cursor</text>
      </g>
      <g transform="translate(80, 456)">
        <circle cx="6" cy="6" r="6" fill="${ACCENT_FOR_SHOT.ok}"/>
        <text x="26" y="11">Auto-builds — zero setup for streamers</text>
      </g>
      <g transform="translate(80, 494)">
        <circle cx="6" cy="6" r="6" fill="${ACCENT_FOR_SHOT.ok}"/>
        <text x="26" y="11">Real-time live indicator via Helix</text>
      </g>
      <g transform="translate(80, 532)">
        <circle cx="6" cy="6" r="6" fill="${ACCENT_FOR_SHOT.ok}"/>
        <text x="26" y="11">Honest provenance — see VOD count</text>
      </g>
      <g transform="translate(80, 570)">
        <circle cx="6" cy="6" r="6" fill="${ACCENT_FOR_SHOT.ok}"/>
        <text x="26" y="11">Works on every channel, no signup needed</text>
      </g>
    </g>

    <text x="80" y="690" font-size="15" font-weight="600" fill="${ACCENT_FOR_SHOT.ok}">collab.deutschmark.online</text>
  </g>

  <!-- Panel shadow plate (real panel is composited on top via sharp) -->
  <rect x="${panelX1}" y="${panelY1}" width="${PANEL_DISPLAY_W}" height="${PANEL_DISPLAY_H}" rx="6" fill="#18181b" filter="url(#panel-shadow)"/>
</svg>`;

// The puppeteer panel was captured at 2x deviceScaleFactor, so it's 636x1000
// physical pixels for a 318x500 logical viewport. Resize to display dimensions.
const panelOkSized = await sharp(panelOk.buf).resize(PANEL_DISPLAY_W, PANEL_DISPLAY_H).png().toBuffer();
await renderSvgWithPanelComposite(
  screenshot1Svg,
  panelOkSized,
  panelX1,
  panelY1,
  PANEL_DISPLAY_W,
  PANEL_DISPLAY_H,
  path.join(outDir, "screenshot-1-overview.png")
);
console.log("wrote screenshot-1-overview.png (1024x768)");

// ── 2. Screenshot 2: anatomy (panel + side callouts) ──────────
// Same measured aspect as screenshot-1.
const PANEL2_W = 380;
const PANEL2_H = Math.round(PANEL2_W / panelAspect);
const panel2X = 80;
const panel2Y = Math.floor((SHOT_H - PANEL2_H) / 2);

const screenshot2Svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SHOT_W}" height="${SHOT_H}" viewBox="0 0 ${SHOT_W} ${SHOT_H}">
  <defs>${SLIDE_DEFS}
    <filter id="panel-shadow2" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="10" stdDeviation="22" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>
  ${bg(SHOT_W, SHOT_H)}

  <g font-family="Inter, Segoe UI, sans-serif" fill="#efeff1">
    <text x="520" y="100" font-size="52" font-weight="800" letter-spacing="-1.6">Built from</text>
    <text x="520" y="158" font-size="52" font-weight="800" letter-spacing="-1.6">broadcast history.</text>
    <text x="520" y="204" font-size="18" font-weight="500" fill="#adadb8">Every element comes from real VODs —</text>
    <text x="520" y="230" font-size="18" font-weight="500" fill="#adadb8">no aspirational schedule, no manual setup.</text>

    <g>
      <g transform="translate(520, 290)">
        <text font-size="17" font-weight="700" fill="#efeff1">a1exzandra goes live</text>
        <text y="26" font-size="15" fill="#adadb8">Streamer name glows softly as the human anchor.</text>
      </g>
      <g transform="translate(520, 360)">
        <text font-size="17" font-weight="700" fill="${ACCENT_FOR_SHOT.live}">Tomorrow / Wednesday / Live for 2h 14m</text>
        <text y="26" font-size="15" fill="#adadb8">Hero auto-swaps: day name → countdown → live timer.</text>
      </g>
      <g transform="translate(520, 430)">
        <text font-size="17" font-weight="700" fill="#efeff1">Weekly calendar with NOW cursor</text>
        <text y="26" font-size="15" fill="#adadb8">Pills at each day's typical hour; today only carries the cursor.</text>
      </g>
      <g transform="translate(520, 500)">
        <text font-size="17" font-weight="700" fill="#efeff1">Honest provenance line</text>
        <text y="26" font-size="15" fill="#adadb8">"as of" tick in broadcaster's tz, pulsing dot for posted schedules.</text>
      </g>
      <g transform="translate(520, 570)">
        <text font-size="17" font-weight="700" fill="#efeff1">Built-in confidence tiers</text>
        <text y="26" font-size="15" fill="#adadb8">Solid pill = certain. Dashed = sparse data. Empty = no signal.</text>
      </g>
    </g>

    <text x="520" y="690" font-size="13" font-weight="500" fill="#6b6b75">Auto-built from up to 60 days of broadcast history</text>
  </g>

  <rect x="${panel2X}" y="${panel2Y}" width="${PANEL2_W}" height="${PANEL2_H}" rx="6" fill="#18181b" filter="url(#panel-shadow2)"/>
</svg>`;

const panelOkSized2 = await sharp(panelOkAnatomy.buf).resize(PANEL2_W, PANEL2_H).png().toBuffer();
await renderSvgWithPanelComposite(
  screenshot2Svg,
  panelOkSized2,
  panel2X,
  panel2Y,
  PANEL2_W,
  PANEL2_H,
  path.join(outDir, "screenshot-2-anatomy.png")
);
console.log("wrote screenshot-2-anatomy.png (1024x768)");

// ── 3. Screenshot 3: config view (smaller card + caption on right) ─
// Mirror screenshot-1's layout: focal element on one side, caption on
// the other. Config card shrunk so the caption gets real estate.
const CFG_W = 290;
const CFG_H = Math.round(CFG_W / configAspect);
const cfgX = 80;
const cfgY = Math.floor((SHOT_H - CFG_H) / 2);

const screenshot3Svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SHOT_W}" height="${SHOT_H}" viewBox="0 0 ${SHOT_W} ${SHOT_H}">
  <defs>${SLIDE_DEFS}
    <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="18" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  ${bg(SHOT_W, SHOT_H)}

  <rect x="${cfgX}" y="${cfgY}" width="${CFG_W}" height="${CFG_H}" rx="6" fill="#18181b" filter="url(#card-shadow)"/>

  <!-- Right-side caption — denser bullets fill the column -->
  <g font-family="Inter, Segoe UI, sans-serif" fill="#efeff1">
    <text x="430" y="140" font-size="56" font-weight="800" letter-spacing="-1.8">Zero setup</text>
    <text x="430" y="200" font-size="56" font-weight="800" letter-spacing="-1.8" fill="${ACCENT_FOR_SHOT.warming}">for streamers.</text>
    <text x="430" y="248" font-size="20" font-weight="500" fill="#adadb8">Install the extension — the panel populates</text>
    <text x="430" y="276" font-size="20" font-weight="500" fill="#adadb8">automatically from your broadcast history.</text>
    <text x="430" y="318" font-size="16" font-weight="500" fill="#6b6b75">Four optional knobs if you want to fine-tune:</text>

    <g font-size="17" fill="#efeff1" font-weight="500">
      <g transform="translate(430, 372)">
        <circle cx="6" cy="6" r="6" fill="${ACCENT_FOR_SHOT.warming}"/>
        <text x="26" y="11"><tspan font-weight="700">Timezone</tspan> — match your stream's local timezone</text>
      </g>
      <g transform="translate(430, 410)">
        <circle cx="6" cy="6" r="6" fill="${ACCENT_FOR_SHOT.warming}"/>
        <text x="26" y="11"><tspan font-weight="700">24-hour time</tspan> — show 19:00 instead of 7 PM</text>
      </g>
      <g transform="translate(430, 448)">
        <circle cx="6" cy="6" r="6" fill="${ACCENT_FOR_SHOT.warming}"/>
        <text x="26" y="11"><tspan font-weight="700">Calendar starts Monday</tspan> — ISO vs US first-day</text>
      </g>
      <g transform="translate(430, 486)">
        <circle cx="6" cy="6" r="6" fill="${ACCENT_FOR_SHOT.warming}"/>
        <text x="26" y="11"><tspan font-weight="700">Accent color</tspan> — auto-pulled from your Twitch profile</text>
      </g>
    </g>

    <text x="430" y="600" font-size="14" font-weight="500" fill="#6b6b75">Twitch dashboard → Extensions → Schedule Forecast → Config</text>
    <text x="430" y="624" font-size="13" fill="#6b6b75">Settings save instantly. Panel updates next refresh.</text>
  </g>
</svg>`;

const configSized = await sharp(configCapture.buf).resize(CFG_W, CFG_H).png().toBuffer();
await renderSvgWithPanelComposite(
  screenshot3Svg,
  configSized,
  cfgX,
  cfgY,
  CFG_W,
  CFG_H,
  path.join(outDir, "screenshot-3-config.png")
);
console.log("wrote screenshot-3-config.png (1024x768)");

console.log("\nAll real-screenshot composites in twitch-extension/assets/");
