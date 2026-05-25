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

// ── Orby chill background — matches the slideshow visual language ────
const ORBY_DEFS = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#0d0518"/>
    <stop offset="100%" stop-color="#1a0a2e"/>
  </linearGradient>
  <radialGradient id="orb-purple" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0%" stop-color="#9147ff" stop-opacity="0.22"/>
    <stop offset="60%" stop-color="#9147ff" stop-opacity="0.05"/>
    <stop offset="100%" stop-color="#9147ff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="orb-teal" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0%" stop-color="#00c8af" stop-opacity="0.16"/>
    <stop offset="60%" stop-color="#00c8af" stop-opacity="0.04"/>
    <stop offset="100%" stop-color="#00c8af" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="orb-blue" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0%" stop-color="#3a7bff" stop-opacity="0.12"/>
    <stop offset="60%" stop-color="#3a7bff" stop-opacity="0.03"/>
    <stop offset="100%" stop-color="#3a7bff" stop-opacity="0"/>
  </radialGradient>
`;
// Orbs sized for a 1024×768 canvas
const ORBY_BG_1024 = `
  <rect width="1024" height="768" fill="url(#bg)"/>
  <ellipse cx="130" cy="660" rx="320" ry="260" fill="url(#orb-purple)"/>
  <ellipse cx="900" cy="130" rx="280" ry="230" fill="url(#orb-teal)"/>
  <ellipse cx="600" cy="720" rx="340" ry="200" fill="url(#orb-blue)"/>
`;

// ── Launch headless Chrome and capture the panel in each preview state ─
console.log("launching headless Chrome…");
const browser = await puppeteer.launch({
  headless: true,
  args: ["--ignore-certificate-errors"], // accept the basic-ssl cert
});

async function capturePanel(previewMode, viewportHeight = 300) {
  // 0.8.0 minimal panel fits well within Twitch's 300px slot. Capture at
  // slot-true height so screenshots reflect what viewers actually see.
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
      "\"Next live\" prediction with day + countdown",
      "Weekly calendar of typical stream blocks",
      "Recently played games with Twitch box art",
      "Multi-partner collab teasers with avatars",
      "Works on every channel — no signup",
    ],
  },
  path.join(outDir, "screenshot-1-overview.png")
);

// ── 2. Anatomy: oversized panel with callouts pointing to each piece ──
const anatomySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>
    ${ORBY_DEFS}
    <linearGradient id="art-grad-1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#9147ff"/>
      <stop offset="100%" stop-color="#5a2cb0"/>
    </linearGradient>
    <linearGradient id="art-grad-2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00c8af"/>
      <stop offset="100%" stop-color="#0a7a6b"/>
    </linearGradient>
    <linearGradient id="art-grad-3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3a7bff"/>
      <stop offset="100%" stop-color="#1e4ba6"/>
    </linearGradient>
  </defs>
  ${ORBY_BG_1024}
  <text x="60" y="80" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="700" fill="#efeff1" letter-spacing="-1.2">Built from broadcast history.</text>
  <text x="60" y="125" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#adadb8">Each element is derived from the streamer's actual VODs — not aspirational.</text>

  <g font-family="Segoe UI, Arial, sans-serif" fill="#efeff1">
    <g transform="translate(610, 230)">
      <text x="0" y="14" font-size="20" fill="#9147ff" font-weight="800">~11PM</text>
      <text x="80" y="11" font-size="15" font-weight="600">Next-live hero</text>
      <text x="80" y="36" font-size="14" fill="#adadb8">Day + countdown + start time —</text>
      <text x="80" y="55" font-size="14" fill="#adadb8">forward-looking, not a stat dump.</text>
    </g>
    <g transform="translate(610, 340)">
      <rect width="14" height="36" rx="3" fill="#9147ff"/>
      <rect x="18" width="14" height="36" rx="3" fill="#9147ff" opacity="0.7"/>
      <text x="80" y="11" font-size="15" font-weight="600">Week calendar</text>
      <text x="80" y="36" font-size="14" fill="#adadb8">Typical stream blocks per day,</text>
      <text x="80" y="55" font-size="14" fill="#adadb8">sized by session duration.</text>
    </g>
    <g transform="translate(610, 460)">
      <rect x="0" y="-3" width="18" height="26" rx="3" fill="url(#art-grad-1)"/>
      <rect x="20" y="-3" width="18" height="26" rx="3" fill="url(#art-grad-2)"/>
      <rect x="40" y="-3" width="18" height="26" rx="3" fill="url(#art-grad-3)"/>
      <text x="80" y="11" font-size="15" font-weight="600">Recently played</text>
      <text x="80" y="36" font-size="14" fill="#adadb8">Twitch box-art thumbnails of</text>
      <text x="80" y="55" font-size="14" fill="#adadb8">the games they actually play.</text>
    </g>
    <g transform="translate(610, 570)">
      <circle cx="11" cy="11" r="11" fill="#9147ff" stroke="#0d0518" stroke-width="2"/>
      <text x="11" y="15" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">A</text>
      <circle cx="28" cy="11" r="11" fill="#00c8af" stroke="#0d0518" stroke-width="2"/>
      <text x="28" y="15" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">B</text>
      <text x="80" y="11" font-size="15" font-weight="600">Collab teasers</text>
      <text x="80" y="36" font-size="14" fill="#adadb8">Partner avatars link to their</text>
      <text x="80" y="55" font-size="14" fill="#adadb8">Twitch — plus game when known.</text>
    </g>
  </g>
</svg>`;
const anatomyBg = renderSvgPng(anatomySvg);
// Panel must fit inside the 1024×768 canvas with a 180px top margin.
// Available height = 768 - 180 - 40 = 548. Constrain by both axes.
const anatomyPanel = await sharp(panelOk)
  .resize({ width: 360, height: 548, fit: "inside", withoutEnlargement: true })
  .png()
  .toBuffer();
await sharp(anatomyBg)
  .composite([{ input: anatomyPanel, left: 80, top: 180 }])
  .png()
  .toFile(path.join(outDir, "screenshot-2-anatomy.png"));
console.log("wrote screenshot-2-anatomy.png");

// ── 3. Colors customization (NEW) — accent-color swatches ─────────────
const colorChips = [
  { hex: "#9146FF", name: "Twitch Purple" },
  { hex: "#FF6600", name: "Sunset" },
  { hex: "#00C8AF", name: "Mint" },
  { hex: "#FF3F8C", name: "Pink" },
  { hex: "#3A7BFF", name: "Sky" },
  { hex: "#F1C40F", name: "Gold" },
];
const colorCardsSvg = colorChips.map((c, i) => {
  const x = (i % 3) * 165;
  const y = Math.floor(i / 3) * 175;
  return `<g transform="translate(${x}, ${y})">
    <rect width="148" height="155" rx="9" fill="#18181b" stroke="#2a2a2e" stroke-width="1"/>
    <g transform="translate(12, 14)">
      <text font-family="Segoe UI, Arial, sans-serif" font-size="8" font-weight="700" fill="#6b6b75" letter-spacing="0.08em">NEXT LIVE</text>
      <text y="34" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="800" fill="${c.hex}" letter-spacing="-0.04em">~11<tspan font-size="13">PM</tspan></text>
      <text y="50" font-family="Segoe UI, Arial, sans-serif" font-size="8" fill="#6b6b75">Eastern Time</text>
      <g transform="translate(0, 68)">
        ${["S","M","T","W","T","F","S"].map((d, j) => `<text x="${j*18}" font-family="Segoe UI, Arial, sans-serif" font-size="9" font-weight="700" fill="${[0,1,3].includes(j) ? c.hex : "#3a3a3d"}" text-anchor="middle">${d}</text>`).join("")}
      </g>
      <g transform="translate(0, 84)">
        ${[0, 1, 3].map((d) => `<rect x="${d*18-7}" y="0" width="14" height="20" rx="3" fill="${c.hex}" fill-opacity="0.92"/>`).join("")}
      </g>
      <text y="135" font-family="Segoe UI, Arial, sans-serif" font-size="8" font-weight="600" fill="#adadb8">${c.name}</text>
      <text x="124" y="135" font-family="ui-monospace, Consolas, monospace" font-size="7" font-weight="500" fill="#6b6b75" text-anchor="end">${c.hex}</text>
    </g>
  </g>`;
}).join("");
const colorsSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>${ORBY_DEFS}</defs>
  ${ORBY_BG_1024}
  <text x="60" y="100" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="#9147ff" letter-spacing="0.12em">YOUR COLOR. YOUR PANEL.</text>
  <text x="60" y="160" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="800" fill="#efeff1" letter-spacing="-1.4">Pick any accent.</text>
  <text x="60" y="210" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="800" fill="#efeff1" letter-spacing="-1.4">Or auto-pull yours</text>
  <text x="60" y="260" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="800" fill="#9147ff" letter-spacing="-1.4">from Twitch.</text>
  <text x="60" y="320" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#adadb8">One-click "Use my Twitch profile color" pulls</text>
  <text x="60" y="343" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#adadb8">your channel's accent straight from your account.</text>
  <text x="60" y="386" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#6b6b75">Or paste any hex. Color cascades through every chip,</text>
  <text x="60" y="407" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#6b6b75">block, link, and button — instantly.</text>
  <g transform="translate(525, 120)">${colorCardsSvg}</g>
</svg>`;
writeFileSync(path.join(outDir, "screenshot-3-colors.png"), renderSvgPng(colorsSvg));
console.log("wrote screenshot-3-colors.png");

// ── 4. Works without a signup — concept-only, no real screenshot ──────
const noSignupSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>${ORBY_DEFS}</defs>
  ${ORBY_BG_1024}
  <text x="60" y="100" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="#00c8af" letter-spacing="0.12em">NO ACCOUNT NEEDED</text>
  <text x="60" y="170" font-family="Segoe UI, Arial, sans-serif" font-size="50" font-weight="800" fill="#efeff1" letter-spacing="-1.6">Works the moment</text>
  <text x="60" y="226" font-family="Segoe UI, Arial, sans-serif" font-size="50" font-weight="800" fill="#efeff1" letter-spacing="-1.6">you install it.</text>
  <text x="60" y="290" font-family="Segoe UI, Arial, sans-serif" font-size="17" fill="#adadb8">Predictions auto-build from your channel's</text>
  <text x="60" y="316" font-family="Segoe UI, Arial, sans-serif" font-size="17" fill="#adadb8">public broadcast history. Zero setup.</text>
  <text x="60" y="372" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#6b6b75">Sign in at collab.deutschmark.online to add planned collabs,</text>
  <text x="60" y="392" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#6b6b75">schedule sync, and sharper signal — totally optional.</text>

  <!-- 3-stage flow: Install → Live → Sign in (optional) -->
  <g transform="translate(60, 470)">
    <g transform="translate(0, 0)">
      <rect width="280" height="220" rx="14" fill="#18181b" stroke="#2a2a2e" stroke-width="1"/>
      <circle cx="140" cy="80" r="38" fill="#9147ff" fill-opacity="0.15" stroke="#9147ff" stroke-width="1.5"/>
      <text x="140" y="90" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="#9147ff" text-anchor="middle">1</text>
      <text x="140" y="150" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="700" fill="#efeff1" text-anchor="middle">Install</text>
      <text x="140" y="175" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#adadb8" text-anchor="middle">on your channel</text>
      <text x="140" y="195" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#adadb8" text-anchor="middle">from the Twitch dashboard</text>
    </g>
    <text x="305" y="125" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#6b6b75">→</text>
    <g transform="translate(340, 0)">
      <rect width="280" height="220" rx="14" fill="#00c8af" fill-opacity="0.08" stroke="#00c8af" stroke-width="1.5"/>
      <circle cx="140" cy="80" r="38" fill="#00c8af" fill-opacity="0.2" stroke="#00c8af" stroke-width="1.5"/>
      <text x="140" y="92" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="#00c8af" text-anchor="middle">✓</text>
      <text x="140" y="150" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="700" fill="#efeff1" text-anchor="middle">Panel is live</text>
      <text x="140" y="175" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#adadb8" text-anchor="middle">predictions from your</text>
      <text x="140" y="195" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#adadb8" text-anchor="middle">broadcast history</text>
    </g>
    <text x="645" y="125" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#6b6b75">→</text>
    <g transform="translate(680, 0)">
      <rect width="280" height="220" rx="14" fill="#18181b" stroke="#6b6b75" stroke-width="1" stroke-dasharray="5 5"/>
      <circle cx="140" cy="80" r="38" fill="#18181b" stroke="#6b6b75" stroke-width="1.5"/>
      <text x="140" y="92" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="#6b6b75" text-anchor="middle">+</text>
      <text x="140" y="150" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700" fill="#adadb8" text-anchor="middle">Sign in</text>
      <text x="140" y="172" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#6b6b75" text-anchor="middle">(optional)</text>
      <text x="140" y="195" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#6b6b75" text-anchor="middle">for collabs + sync</text>
    </g>
  </g>
</svg>`;
writeFileSync(path.join(outDir, "screenshot-4-no-signup.png"), renderSvgPng(noSignupSvg));
console.log("wrote screenshot-4-no-signup.png");

// ── 4. Empty / no_data states — bonus, not for dashboard ──────────────
writeFileSync(path.join(outDir, "_capture-empty.png"), panelEmpty);
writeFileSync(path.join(outDir, "_capture-no-data.png"), panelNoData);
console.log("wrote bonus captures (_capture-empty.png, _capture-no-data.png)");

console.log("\nDone — three dashboard screenshots in twitch-extension/assets/");
