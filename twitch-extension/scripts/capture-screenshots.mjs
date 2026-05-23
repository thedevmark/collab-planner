// Captures real screenshots of the running panel (via puppeteer against
// the vite HTTPS dev server), then composites each into a 1024x768 Twitch
// detail-page frame with explanatory copy on the side. Replaces the SVG
// mockups in generate-assets.mjs with pixel-accurate captures of the
// actual rendered panel.
//
// Prereqs:
//   - `npm run dev` running in twitch-extension (https://localhost:5173)
//   - puppeteer installed at the repo root

import puppeteer from "puppeteer";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const outDir = path.resolve(here, "..", "assets");
mkdirSync(outDir, { recursive: true });

const VITE = "https://localhost:5173";

// Inter font buffers reused for resvg-rendered captions.
const interDir = path.join(repoRoot, "node_modules/@fontsource/inter/files");
const interFontBuffers = [400, 500, 600, 700].map((w) =>
  readFileSync(path.join(interDir, `inter-latin-${w}-normal.woff2`))
);
function renderSvgPng(svg) {
  return new Resvg(svg, {
    font: { fontBuffers: interFontBuffers, defaultFontFamily: "Segoe UI", loadSystemFonts: true },
  }).render().asPng();
}

// ── Launch headless Chrome and capture the panel in each preview state ─
console.log("launching headless Chrome…");
const browser = await puppeteer.launch({
  headless: true,
  args: ["--ignore-certificate-errors"], // accept the basic-ssl cert
});

async function capturePanel(previewMode, viewportHeight = 480) {
  const page = await browser.newPage();
  await page.setViewport({ width: 340, height: viewportHeight, deviceScaleFactor: 1 });
  await page.goto(`${VITE}/panel.html?preview=${previewMode}`, { waitUntil: "networkidle0", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 300)); // settle
  const buf = await page.screenshot({ type: "png", fullPage: false });
  await page.close();
  return buf;
}

async function captureConfigState(stateLabel, html) {
  // Inject a static config-card snapshot — config.tsx normally needs a JWT,
  // so we render an HTML stub against vite to capture the styled card.
  const page = await browser.newPage();
  await page.setViewport({ width: 460, height: 360, deviceScaleFactor: 1 });
  await page.goto(`${VITE}/panel.html?preview=ok`, { waitUntil: "networkidle0" }); // pull stylesheet
  await page.evaluate((h) => {
    document.body.innerHTML = `<div id="root">${h}</div>`;
  }, html);
  await new Promise((r) => setTimeout(r, 200));
  const buf = await page.screenshot({ type: "png", fullPage: false, clip: { x: 0, y: 0, width: 460, height: 360 } });
  await page.close();
  console.log(`captured config state: ${stateLabel}`);
  return buf;
}

console.log("capturing panel — preview=ok…");
const panelOk = await capturePanel("ok", 360);
console.log("capturing panel — preview=empty…");
const panelEmpty = await capturePanel("empty", 220);
console.log("capturing panel — preview=no_data…");
const panelNoData = await capturePanel("no_data", 160);

console.log("capturing config card — fresh install…");
const configFresh = await captureConfigState(
  "fresh-install",
  `<h1>Collab Planner</h1>
   <p>Your channel isn't connected yet. Sign in with Twitch at Collab Planner — your panel will start working automatically.</p>
   <p><a class="cta" href="#" target="_blank" rel="noopener noreferrer">Sign in with Twitch ↗</a></p>`
);
console.log("capturing config card — connected…");
const configConnected = await captureConfigState(
  "connected",
  `<h1>Collab Planner <span style="color:#00c8af">&#10004;</span></h1>
   <p>Account detected. Streams Sun, Tue, Mon — 2 upcoming collabs.</p>
   <p><a class="cta" href="#" target="_blank" rel="noopener noreferrer">Open dashboard ↗</a></p>`
);

await browser.close();
console.log("browser closed");

// ── Composite each capture into a 1024x768 frame ──────────────────────
const PAGE_BG = { r: 13, g: 5, b: 24, alpha: 1 };

function captionSvg(title, subtitleLines, bullets) {
  const subtitleEls = subtitleLines
    .map(
      (line, i) =>
        `<text x="0" y="${100 + i * 26}" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#adadb8">${line}</text>`
    )
    .join("");
  const bulletStartY = 100 + subtitleLines.length * 26 + 40;
  const bulletLines = bullets
    .map(
      (b, i) => `
      <g transform="translate(0, ${i * 36})">
        <circle cx="6" cy="6" r="6" fill="#9147ff"/>
        <text x="22" y="11" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#efeff1">${b}</text>
      </g>`
    )
    .join("");
  // Narrower width (480) so the caption can't bleed under the panel (which
  // sits at left=560 in the 1024×768 frame).
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="560" viewBox="0 0 480 560">
  <text x="0" y="60" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="700" fill="#efeff1" letter-spacing="-1.2">${title}</text>
  ${subtitleEls}
  <g transform="translate(0, ${bulletStartY})">${bulletLines}</g>
</svg>`;
}

async function compose(captureBuf, captionSvgStr, outPath) {
  const captionPng = renderSvgPng(captionSvg(captionSvgStr.title, captionSvgStr.subtitle, captionSvgStr.bullets));

  // Scale the captured panel up so it reads at Twitch dashboard size, but
  // not so much that it overlaps the caption text on the left. Panel is
  // designed for 340px width in production; ~1.3× keeps the bullets
  // comfortably readable next to it.
  const scaledPanel = await sharp(captureBuf).resize({ width: 440 }).png().toBuffer();

  const bg = await sharp({
    create: { width: 1024, height: 768, channels: 4, background: PAGE_BG },
  }).png().toBuffer();

  // Caption left (60–540), scaled panel right (560+), centered vertically.
  await sharp(bg)
    .composite([
      { input: captionPng, left: 60, top: 130 },
      { input: scaledPanel, left: 560, top: 130 },
    ])
    .png()
    .toFile(outPath);
  console.log(`wrote ${path.basename(outPath)}`);
}

// ── 1. Hero: the panel populated with bullets explaining what it shows ─
await compose(
  panelOk,
  {
    title: "Schedule Forecast",
    subtitle: [
      "When this streamer is likely live —",
      "auto-built from broadcast history.",
    ],
    bullets: [
      "Plain-English summary",
      "7-day chip row, active days highlighted",
      "Most-played game tag",
      "Upcoming collabs when planned",
      "Works on every channel",
    ],
  },
  path.join(outDir, "screenshot-1-overview.png")
);

// ── 2. Anatomy: oversized panel with callouts pointing to each piece ──
// Render the panel at deviceScaleFactor 2 (we did) so 340×360 → 680×720 PNG.
// Then composite a captioned breakdown of the elements.
const anatomySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <rect width="1024" height="768" fill="#0d0518"/>
  <text x="60" y="100" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="700" fill="#efeff1" letter-spacing="-1.2">Built from broadcast history.</text>
  <text x="60" y="148" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#adadb8">Each element is derived from the streamer's actual VODs — not aspirational.</text>

  <g font-family="Segoe UI, Arial, sans-serif" fill="#efeff1">
    <g transform="translate(610, 240)">
      <text x="0" y="11" fill="#adadb8" font-size="18">↗</text>
      <text x="24" y="11" font-size="15" font-weight="600">Plain-English summary</text>
      <text x="24" y="36" font-size="14" fill="#adadb8">Top 3 streaming days +</text>
      <text x="24" y="55" font-size="14" fill="#adadb8">median start time, your local TZ.</text>
    </g>
    <g transform="translate(610, 340)">
      <rect width="14" height="14" rx="3" fill="#9147ff"/>
      <text x="24" y="11" font-size="15" font-weight="600">7-day chip row</text>
      <text x="24" y="36" font-size="14" fill="#adadb8">Active days highlighted —</text>
      <text x="24" y="55" font-size="14" fill="#adadb8">scannable at a glance.</text>
    </g>
    <g transform="translate(610, 440)">
      <circle cx="7" cy="7" r="6" fill="#00c8af"/>
      <text x="24" y="11" font-size="15" font-weight="600">Posted schedule indicator</text>
      <text x="24" y="36" font-size="14" fill="#adadb8">Teal dot when the streamer</text>
      <text x="24" y="55" font-size="14" fill="#adadb8">has a Twitch schedule posted.</text>
    </g>
    <g transform="translate(610, 540)">
      <rect x="0" y="-2" width="14" height="14" rx="3" fill="none" stroke="#3a3a3d" stroke-width="1.5"/>
      <text x="24" y="11" font-size="15" font-weight="600">Most-played game</text>
      <text x="24" y="36" font-size="14" fill="#adadb8">From their recent VOD</text>
      <text x="24" y="55" font-size="14" fill="#adadb8">category metadata.</text>
    </g>
  </g>
</svg>`;
const anatomyBg = renderSvgPng(anatomySvg);
const anatomyPanel = await sharp(panelOk).resize({ width: 480 }).png().toBuffer();
await sharp(anatomyBg)
  .composite([{ input: anatomyPanel, left: 80, top: 200 }])
  .png()
  .toFile(path.join(outDir, "screenshot-2-anatomy.png"));
console.log("wrote screenshot-2-anatomy.png");

// ── 3. Config view: two cards side-by-side (fresh install + connected) ─
const configFrameSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <rect width="1024" height="768" fill="#0d0518"/>
  <text x="60" y="100" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="700" fill="#efeff1" letter-spacing="-1.2">Zero setup for streamers.</text>
  <text x="60" y="148" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#adadb8">Install it. The schedule appears. Connect Collab Planner for more.</text>
  <text x="60" y="700" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#6b6b75">Broadcaster config view (Twitch dashboard)</text>
</svg>`;
const configBg = renderSvgPng(configFrameSvg);
const cardFresh = await sharp(configFresh).resize({ width: 420 }).png().toBuffer();
const cardConnected = await sharp(configConnected).resize({ width: 420 }).png().toBuffer();
await sharp(configBg)
  .composite([
    { input: cardFresh, left: 60, top: 220 },
    { input: cardConnected, left: 544, top: 220 },
  ])
  .png()
  .toFile(path.join(outDir, "screenshot-3-config.png"));
console.log("wrote screenshot-3-config.png");

// ── 4. Empty / no_data states — bonus, not for dashboard ──────────────
writeFileSync(path.join(outDir, "_capture-empty.png"), panelEmpty);
writeFileSync(path.join(outDir, "_capture-no-data.png"), panelNoData);
console.log("wrote bonus captures (_capture-empty.png, _capture-no-data.png)");

console.log("\nDone — three dashboard screenshots in twitch-extension/assets/");
