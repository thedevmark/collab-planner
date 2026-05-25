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

async function capturePanel(previewMode, viewportHeight = 540) {
  const page = await browser.newPage();
  await page.setViewport({ width: 340, height: viewportHeight, deviceScaleFactor: 1 });
  await page.goto(`${VITE}/panel.html?preview=${previewMode}`, { waitUntil: "networkidle0", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 400));
  const buf = await page.screenshot({ type: "png", fullPage: false });
  await page.close();
  return buf;
}

async function captureConfig(previewMode, viewportHeight = 720) {
  // 0.4.0 settings form renders against config.html when ?preview= is set
  // (config.tsx populates a fake authState in preview mode).
  const page = await browser.newPage();
  await page.setViewport({ width: 380, height: viewportHeight, deviceScaleFactor: 1 });
  await page.goto(`${VITE}/config.html?preview=${previewMode}`, { waitUntil: "networkidle0", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 500));
  const buf = await page.screenshot({ type: "png", fullPage: false });
  await page.close();
  console.log(`captured config (preview=${previewMode})`);
  return buf;
}

console.log("capturing panel — preview=ok (full layout, 0.4.0)…");
const panelOk = await capturePanel("ok", 560);
console.log("capturing panel — preview=empty…");
const panelEmpty = await capturePanel("empty", 460);
console.log("capturing panel — preview=no_data…");
const panelNoData = await capturePanel("no_data", 200);

console.log("capturing config — connected w/ settings form…");
const configConnected = await captureConfig("connected", 760);
console.log("capturing config — not in CP (fresh install)…");
const configFresh = await captureConfig("not_in_cp", 760);

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

  // Fit the panel to the right column of the 1024×768 frame without
  // exceeding the canvas height. Panel column ~400px wide × ~520px tall.
  const scaledPanel = await sharp(captureBuf)
    .resize({ width: 400, height: 520, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  const bg = await sharp({
    create: { width: 1024, height: 768, channels: 4, background: PAGE_BG },
  }).png().toBuffer();

  await sharp(bg)
    .composite([
      { input: captionPng, left: 60, top: 130 },
      { input: scaledPanel, left: 580, top: 130 },
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
      "Hero start-time in their timezone",
      "Weekly calendar of typical stream blocks",
      "Last live + game played",
      "Upcoming collabs when planned",
      "Works on every channel — no signup",
    ],
  },
  path.join(outDir, "screenshot-1-overview.png")
);

// ── 2. Anatomy: oversized panel with callouts pointing to each piece ──
const anatomySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <rect width="1024" height="768" fill="#0d0518"/>
  <text x="60" y="100" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="700" fill="#efeff1" letter-spacing="-1.2">Built from broadcast history.</text>
  <text x="60" y="148" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#adadb8">Each element is derived from the streamer's actual VODs — not aspirational.</text>

  <g font-family="Segoe UI, Arial, sans-serif" fill="#efeff1">
    <g transform="translate(610, 220)">
      <text x="0" y="11" fill="#adadb8" font-size="18">↗</text>
      <text x="24" y="11" font-size="15" font-weight="600">Plain-English summary</text>
      <text x="24" y="36" font-size="14" fill="#adadb8">Top streaming days + median</text>
      <text x="24" y="55" font-size="14" fill="#adadb8">start time in their timezone.</text>
    </g>
    <g transform="translate(610, 320)">
      <rect width="14" height="14" rx="3" fill="#9147ff"/>
      <text x="24" y="11" font-size="15" font-weight="600">7-day chip row</text>
      <text x="24" y="36" font-size="14" fill="#adadb8">Active days highlighted —</text>
      <text x="24" y="55" font-size="14" fill="#adadb8">scannable at a glance.</text>
    </g>
    <g transform="translate(610, 420)">
      <rect x="0" y="-2" width="6" height="14" rx="2" fill="#9147ff"/>
      <rect x="8" y="-2" width="6" height="14" rx="2" fill="#9147ff" opacity="0.7"/>
      <text x="24" y="11" font-size="15" font-weight="600">Weekly calendar</text>
      <text x="24" y="36" font-size="14" fill="#adadb8">Typical stream blocks — start</text>
      <text x="24" y="55" font-size="14" fill="#adadb8">time × duration per day.</text>
    </g>
    <g transform="translate(610, 530)">
      <text x="0" y="11" font-size="18" fill="#6b6b75">⏱</text>
      <text x="24" y="11" font-size="15" font-weight="600">Last live</text>
      <text x="24" y="36" font-size="14" fill="#adadb8">Relative time + game from</text>
      <text x="24" y="55" font-size="14" fill="#adadb8">their most recent broadcast.</text>
    </g>
  </g>
</svg>`;
const anatomyBg = renderSvgPng(anatomySvg);
// Resize panel so it fits inside the 1024×768 canvas with a 200px top margin.
// Max available height = 768 - 200 - 40 (bottom breathing room) = 528. Panel
// capture is 340×540 (varies), so resize to width that produces ≤ 528 tall.
const anatomyPanel = await sharp(panelOk)
  .resize({ width: 320, height: 510, fit: "inside", withoutEnlargement: true })
  .png()
  .toBuffer();
await sharp(anatomyBg)
  .composite([{ input: anatomyPanel, left: 80, top: 200 }])
  .png()
  .toFile(path.join(outDir, "screenshot-2-anatomy.png"));
console.log("wrote screenshot-2-anatomy.png");

// ── 3. Config view: two cards side-by-side (no signup vs. connected) ──
const configFrameSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <rect width="1024" height="768" fill="#0d0518"/>
  <text x="60" y="100" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="700" fill="#efeff1" letter-spacing="-1.2">Works without a signup.</text>
  <text x="60" y="148" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#adadb8">Panel is live the moment you install it. Sign in for richer signal — optional.</text>
  <text x="120" y="195" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="600" fill="#00c8af" letter-spacing="0.08em">NO ACCOUNT NEEDED</text>
  <text x="604" y="195" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="600" fill="#9147ff" letter-spacing="0.08em">SIGNED IN — MORE FEATURES</text>
  <text x="60" y="710" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#6b6b75">Broadcaster config view (Twitch dashboard)</text>
</svg>`;
const configBg = renderSvgPng(configFrameSvg);
// Fit each config card into a ~420×450 box (the 1024-wide canvas has
// room for two side-by-side, and 768-220-60 = 488px of vertical space).
const cardFresh = await sharp(configFresh)
  .resize({ width: 420, height: 480, fit: "inside", withoutEnlargement: true })
  .png()
  .toBuffer();
const cardConnected = await sharp(configConnected)
  .resize({ width: 420, height: 480, fit: "inside", withoutEnlargement: true })
  .png()
  .toBuffer();
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
