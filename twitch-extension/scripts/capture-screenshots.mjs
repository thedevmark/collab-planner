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

// ── Interface accent + orby chill background ─────────────────────────
// Interface accent uses the broadcaster's Twitch profile color (#1D4470)
// across all panel mockups, version chips, and slide accents.
const INTERFACE_ACCENT = "#1D4470";

// Background: purple presence halved, sea-green/cyan boosted so the
// page feels less Twitch-purple-by-default and more your-brand.
const ORBY_DEFS = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#0d0518"/>
    <stop offset="100%" stop-color="#0a1822"/>
  </linearGradient>
  <radialGradient id="orb-purple" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0%" stop-color="#9147ff" stop-opacity="0.11"/>
    <stop offset="60%" stop-color="#9147ff" stop-opacity="0.025"/>
    <stop offset="100%" stop-color="#9147ff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="orb-cyan" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0%" stop-color="#2ec4b6" stop-opacity="0.26"/>
    <stop offset="60%" stop-color="#2ec4b6" stop-opacity="0.07"/>
    <stop offset="100%" stop-color="#2ec4b6" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="orb-teal" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0%" stop-color="#00c8af" stop-opacity="0.20"/>
    <stop offset="60%" stop-color="#00c8af" stop-opacity="0.05"/>
    <stop offset="100%" stop-color="#00c8af" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="orb-blue" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0%" stop-color="#1D4470" stop-opacity="0.20"/>
    <stop offset="60%" stop-color="#1D4470" stop-opacity="0.05"/>
    <stop offset="100%" stop-color="#1D4470" stop-opacity="0"/>
  </radialGradient>
`;
// Orbs sized for a 1024×768 canvas — cyan + teal dominant, purple subtle
const ORBY_BG_1024 = `
  <rect width="1024" height="768" fill="url(#bg)"/>
  <ellipse cx="850" cy="130" rx="340" ry="280" fill="url(#orb-cyan)"/>
  <ellipse cx="130" cy="660" rx="320" ry="260" fill="url(#orb-teal)"/>
  <ellipse cx="600" cy="720" rx="340" ry="200" fill="url(#orb-blue)"/>
  <ellipse cx="450" cy="180" rx="220" ry="180" fill="url(#orb-purple)"/>
`;

// ── Launch headless Chrome and capture the panel in each preview state ─
console.log("launching headless Chrome…");
const browser = await puppeteer.launch({
  headless: true,
  args: ["--ignore-certificate-errors"], // accept the basic-ssl cert
});

async function capturePanel(previewMode, viewportHeight = 300) {
  const page = await browser.newPage();
  await page.setViewport({ width: 340, height: viewportHeight, deviceScaleFactor: 1 });
  await page.goto(`${VITE}/panel.html?preview=${previewMode}`, { waitUntil: "networkidle0", timeout: 15000 });
  // Override the panel's CSS accent so the screenshot reflects the
  // broadcaster's actual Twitch profile color (#1D4470) instead of
  // the default Twitch purple. Panel code reads `var(--accent)`.
  await page.evaluate((accent) => {
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-text", "#FFFFFF");
  }, INTERFACE_ACCENT);
  await new Promise((r) => setTimeout(r, 400));
  const buf = await page.screenshot({ type: "png", fullPage: false });
  await page.close();
  return buf;
}

async function captureConfig(previewMode, viewportHeight = 720) {
  const page = await browser.newPage();
  await page.setViewport({ width: 380, height: viewportHeight, deviceScaleFactor: 1 });
  await page.goto(`${VITE}/config.html?preview=${previewMode}`, { waitUntil: "networkidle0", timeout: 15000 });
  await page.evaluate((accent) => {
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-text", "#FFFFFF");
  }, INTERFACE_ACCENT);
  await new Promise((r) => setTimeout(r, 500));
  const buf = await page.screenshot({ type: "png", fullPage: false });
  await page.close();
  console.log(`captured config (preview=${previewMode})`);
  return buf;
}

console.log("capturing panel — preview=ok (rich 0.9.0 layout)…");
const panelOk = await capturePanel("ok", 720);
console.log("capturing panel — preview=empty…");
const panelEmpty = await capturePanel("empty", 540);
console.log("capturing panel — preview=no_data…");
const panelNoData = await capturePanel("no_data", 100);

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

  const scaledPanel = await sharp(captureBuf)
    .resize({ width: 400, height: 520, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  // Background = orby gradient (matches slideshow aesthetic), not flat color
  const bgSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>${ORBY_DEFS}</defs>
  ${ORBY_BG_1024}
</svg>`;
  const bg = renderSvgPng(bgSvg);

  await sharp(bg)
    .composite([
      { input: captionPng, left: 60, top: 130 },
      { input: scaledPanel, left: 580, top: 130 },
    ])
    .png()
    .toFile(outPath);
  console.log(`wrote ${path.basename(outPath)}`);
}

// ── 1. Overview — text-left + 2×2 feature card grid right ──────
// Same layout pattern as screenshot 2 (colors): substantial left
// column with caption/headline/body, dense visual grid on right.
const featureCards = [
  {
    title: "next live",
    sub: "day + countdown + start time",
    visual: `<text y="36" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="800" fill="${INTERFACE_ACCENT}" letter-spacing="-0.04em">~11<tspan font-size="16">PM</tspan></text>
             <text y="56" font-family="Segoe UI, Arial, sans-serif" font-size="10" fill="#6b6b75">Monday · tonight</text>`,
  },
  {
    title: "week view",
    sub: "typical blocks per day",
    visual: `${[0, 1, 3].map((d) => `<rect x="${d * 20}" y="14" width="14" height="34" rx="3" fill="${INTERFACE_ACCENT}" fill-opacity="0.9"/>`).join("")}
             ${[2, 4, 5, 6].map((d) => `<rect x="${d * 20}" y="14" width="14" height="34" rx="3" fill="#2a2a2e"/>`).join("")}
             <g font-family="Segoe UI, Arial, sans-serif" font-size="8" font-weight="600">
               ${["S","M","T","W","T","F","S"].map((d, i) => `<text x="${i*20+7}" y="62" fill="${[0,1,3].includes(i) ? INTERFACE_ACCENT : "#3a3a3d"}" text-anchor="middle">${d}</text>`).join("")}
             </g>`,
  },
  {
    title: "recent games",
    sub: "real Twitch box art",
    visual: `<rect x="0" y="10" width="32" height="42" rx="3" fill="url(#art-grad-1)"/>
             <rect x="38" y="10" width="32" height="42" rx="3" fill="url(#art-grad-2)"/>
             <rect x="76" y="10" width="32" height="42" rx="3" fill="url(#art-grad-3)"/>`,
  },
  {
    title: "collab teasers",
    sub: "linked partner avatars",
    visual: `<circle cx="14" cy="30" r="14" fill="${INTERFACE_ACCENT}"/>
             <text x="14" y="34" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">A</text>
             <circle cx="36" cy="30" r="14" fill="#2ec4b6"/>
             <text x="36" y="34" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">B</text>
             <text x="56" y="34" font-family="Segoe UI, Arial, sans-serif" font-size="10" fill="#adadb8">@alice, @bob</text>`,
  },
];
const featureCardsSvg = featureCards.map((c, i) => {
  const x = (i % 2) * 175;
  const y = Math.floor(i / 2) * 165;
  return `<g transform="translate(${x}, ${y})">
    <rect width="160" height="150" rx="11" fill="#18181b" stroke="#2a2a2e" stroke-width="1"/>
    <g transform="translate(16, 18)">
      ${c.visual}
      <text y="100" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" fill="#efeff1">${c.title}</text>
      <text y="120" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#6b6b75">${c.sub}</text>
    </g>
  </g>`;
}).join("");
const overviewSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>
    ${ORBY_DEFS}
    <linearGradient id="art-grad-1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${INTERFACE_ACCENT}"/>
      <stop offset="100%" stop-color="#0d2a48"/>
    </linearGradient>
    <linearGradient id="art-grad-2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2ec4b6"/>
      <stop offset="100%" stop-color="#0a7a6b"/>
    </linearGradient>
    <linearGradient id="art-grad-3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3a7bff"/>
      <stop offset="100%" stop-color="#1e4ba6"/>
    </linearGradient>
  </defs>
  ${ORBY_BG_1024}

  <text x="60" y="100" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="${INTERFACE_ACCENT}" letter-spacing="0.12em">SCHEDULE FORECAST</text>
  <text x="60" y="170" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="800" fill="#efeff1" letter-spacing="-1.6">when they're</text>
  <text x="60" y="225" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="800" fill="${INTERFACE_ACCENT}" letter-spacing="-1.6">next live.</text>
  <text x="60" y="295" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#adadb8">built from your real broadcast history.</text>
  <text x="60" y="319" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#adadb8">works on every channel. no signup needed.</text>

  <g transform="translate(560, 130)">${featureCardsSvg}</g>
</svg>`;
writeFileSync(path.join(outDir, "screenshot-1.png"), renderSvgPng(overviewSvg));
console.log("wrote screenshot-1.png");

// ── 2. Colors customization — accent-color swatches ─────────────
// First slot is the broadcaster's own Twitch profile color (the
// auto-detected default when they click "use my Twitch color").
const colorChips = [
  { hex: INTERFACE_ACCENT, name: "your Twitch color" },
  { hex: "#9146FF", name: "Twitch Purple" },
  { hex: "#FF6600", name: "Sunset" },
  { hex: "#2EC4B6", name: "Sea" },
  { hex: "#FF3F8C", name: "Pink" },
  { hex: "#F1C40F", name: "Gold" },
];
// Simplified swatches — just the color + the hero number shown in that
// color + the name + hex. Lets the COLOR be the focal point, not the
// surrounding panel chrome.
const colorCardsSvg = colorChips.map((c, i) => {
  const x = (i % 3) * 165;
  const y = Math.floor(i / 3) * 180;
  return `<g transform="translate(${x}, ${y})">
    <rect width="148" height="160" rx="14" fill="${c.hex}" fill-opacity="0.08" stroke="${c.hex}" stroke-opacity="0.35" stroke-width="1"/>
    <text x="74" y="78" font-family="Segoe UI, Arial, sans-serif" font-size="36" font-weight="800" fill="${c.hex}" letter-spacing="-0.04em" text-anchor="middle">~11<tspan font-size="18">PM</tspan></text>
    <text x="74" y="120" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="600" fill="#efeff1" text-anchor="middle">${c.name}</text>
    <text x="74" y="142" font-family="ui-monospace, Consolas, monospace" font-size="11" font-weight="500" fill="#6b6b75" text-anchor="middle">${c.hex}</text>
  </g>`;
}).join("");
const colorsSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>${ORBY_DEFS}</defs>
  ${ORBY_BG_1024}
  <text x="60" y="100" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="${INTERFACE_ACCENT}" letter-spacing="0.12em">YOUR COLOR.</text>
  <text x="60" y="170" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="800" fill="#efeff1" letter-spacing="-1.6">pick a color or pull</text>
  <text x="60" y="225" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="800" fill="${INTERFACE_ACCENT}" letter-spacing="-1.6">yours from Twitch.</text>
  <text x="60" y="295" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#adadb8">one click. cascades through every chip, block, button.</text>
  <g transform="translate(525, 120)">${colorCardsSvg}</g>
</svg>`;
writeFileSync(path.join(outDir, "screenshot-2.png"), renderSvgPng(colorsSvg));
console.log("wrote screenshot-2.png");

// ── 3. No-signup — text-left + stacked stage cards right ──────
const noSignupSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>${ORBY_DEFS}</defs>
  ${ORBY_BG_1024}

  <text x="60" y="100" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="#2ec4b6" letter-spacing="0.12em">NO SIGNUP NEEDED</text>
  <text x="60" y="170" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="800" fill="#efeff1" letter-spacing="-1.6">works the second</text>
  <text x="60" y="225" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="800" fill="#efeff1" letter-spacing="-1.6">you install it.</text>
  <text x="60" y="295" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#adadb8">predictions built from your channel's</text>
  <text x="60" y="319" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#adadb8">public broadcast history. no setup.</text>
  <text x="60" y="395" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#6b6b75">sign in at collab.deutschmark.online to add</text>
  <text x="60" y="415" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#6b6b75">planned collabs and sharper signal — optional.</text>

  <!-- Right column: 3 stage cards stacked vertically -->
  <g transform="translate(525, 110)">
    <g transform="translate(0, 0)">
      <rect width="440" height="160" rx="14" fill="#18181b" stroke="#2a2a2e" stroke-width="1"/>
      <circle cx="80" cy="80" r="38" fill="${INTERFACE_ACCENT}" fill-opacity="0.18" stroke="${INTERFACE_ACCENT}" stroke-width="1.5"/>
      <text x="80" y="90" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="700" fill="${INTERFACE_ACCENT}" text-anchor="middle">1</text>
      <text x="155" y="62" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="700" fill="#6b6b75" letter-spacing="0.08em">STEP ONE</text>
      <text x="155" y="92" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#efeff1">install</text>
      <text x="155" y="118" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#adadb8">on your channel from the Twitch dashboard.</text>
    </g>
    <g transform="translate(0, 180)">
      <rect width="440" height="160" rx="14" fill="#2ec4b6" fill-opacity="0.08" stroke="#2ec4b6" stroke-width="1.5"/>
      <circle cx="80" cy="80" r="38" fill="#2ec4b6" fill-opacity="0.2" stroke="#2ec4b6" stroke-width="1.5"/>
      <text x="80" y="92" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="700" fill="#2ec4b6" text-anchor="middle">✓</text>
      <text x="155" y="62" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="700" fill="#2ec4b6" letter-spacing="0.08em">IT'S LIVE</text>
      <text x="155" y="92" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#efeff1">panel works</text>
      <text x="155" y="118" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#adadb8">predictions auto-built from your broadcasts.</text>
    </g>
    <g transform="translate(0, 360)">
      <rect width="440" height="160" rx="14" fill="#18181b" stroke="#6b6b75" stroke-width="1" stroke-dasharray="5 5"/>
      <circle cx="80" cy="80" r="38" fill="#18181b" stroke="#6b6b75" stroke-width="1.5"/>
      <text x="80" y="92" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="#6b6b75" text-anchor="middle">+</text>
      <text x="155" y="62" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="700" fill="#6b6b75" letter-spacing="0.08em">OPTIONAL</text>
      <text x="155" y="92" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#adadb8">sign in</text>
      <text x="155" y="118" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#6b6b75">add planned collabs + schedule sync.</text>
    </g>
  </g>
</svg>`;
writeFileSync(path.join(outDir, "screenshot-3.png"), renderSvgPng(noSignupSvg));
console.log("wrote screenshot-3.png");

// ── 4. Empty / no_data states — bonus, not for dashboard ──────────────
writeFileSync(path.join(outDir, "_capture-empty.png"), panelEmpty);
writeFileSync(path.join(outDir, "_capture-no-data.png"), panelNoData);
console.log("wrote bonus captures (_capture-empty.png, _capture-no-data.png)");

console.log("\nDone — three dashboard screenshots in twitch-extension/assets/");
