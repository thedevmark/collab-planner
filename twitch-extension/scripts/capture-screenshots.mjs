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
// Sea cyan #2EC4B6 reads brighter against the dark orby bg and pops in
// the Twitch dashboard preview. The "your Twitch color" swatch on slide
// 2 still uses the real broadcaster blue (#1D4470) to demo personalization.
const INTERFACE_ACCENT = "#2EC4B6";
const TWITCH_PROFILE_BLUE = "#1D4470";

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
  await page.evaluate((accent) => {
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-text", "#FFFFFF");
    // For screenshot purposes, kill the margin-top:auto on the footer
    // so it sits flush with the content above (no dead gap in the capture).
    const footer = document.querySelector(".powered-by");
    if (footer) footer.style.marginTop = "8px";
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
const panelOk = await capturePanel("ok", 580);
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

// ── 1. Overview — headline left, real panel screenshot right ────────
// First impression: text on left, the actual product on the right with
// rounded corners, drop shadow, and a subtle accent glow halo behind it.
const panelOkDataUri = `data:image/png;base64,${panelOk.toString("base64")}`;
// Panel capture is 340w × 580h. Match aspect for display: 380×648.
const PW = 380, PH = 648;
const overviewSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>
    ${ORBY_DEFS}
    <radialGradient id="panel-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${INTERFACE_ACCENT}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${INTERFACE_ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="panel-round">
      <rect width="${PW}" height="${PH}" rx="20" ry="20"/>
    </clipPath>
    <filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="20"/>
      <feOffset dx="0" dy="14" result="off"/>
      <feFlood flood-color="#000000" flood-opacity="0.55"/>
      <feComposite in2="off" operator="in"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  ${ORBY_BG_1024}

  <!-- Headline on the left -->
  <text x="60" y="120" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="${INTERFACE_ACCENT}" letter-spacing="0.14em">SCHEDULE FORECAST</text>
  <text x="60" y="220" font-family="Segoe UI, Arial, sans-serif" font-size="64" font-weight="800" fill="#efeff1" letter-spacing="-2">Predicts when</text>
  <text x="60" y="290" font-family="Segoe UI, Arial, sans-serif" font-size="64" font-weight="800" fill="${INTERFACE_ACCENT}" letter-spacing="-2">they go live.</text>
  <text x="60" y="370" font-family="Segoe UI, Arial, sans-serif" font-size="17" fill="#adadb8">Built from your real broadcast history.</text>
  <text x="60" y="396" font-family="Segoe UI, Arial, sans-serif" font-size="17" fill="#adadb8">Works on every channel.</text>

  <!-- Panel showcase on the right -->
  <g transform="translate(560, 80)">
    <!-- Subtle accent glow halo behind the panel -->
    <ellipse cx="${PW/2}" cy="${PH/2}" rx="${PW/2+60}" ry="${PH/2+30}" fill="url(#panel-glow)" opacity="0.6"/>
    <!-- Panel with soft drop shadow + rounded corners -->
    <g filter="url(#soft-shadow)">
      <image href="${panelOkDataUri}" width="${PW}" height="${PH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#panel-round)"/>
      <!-- Crisp 1px border on top for definition -->
      <rect width="${PW}" height="${PH}" rx="20" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    </g>
  </g>
</svg>`;
writeFileSync(path.join(outDir, "screenshot-1.png"), renderSvgPng(overviewSvg));
console.log("wrote screenshot-1.png");

// ── 2. Colors customization — accent-color swatches ─────────────
// First slot is the broadcaster's own Twitch profile color (the
// auto-detected default when they click "use my Twitch color").
const colorChips = [
  { hex: TWITCH_PROFILE_BLUE, name: "your Twitch color" },
  { hex: "#9146FF", name: "Twitch Purple" },
  { hex: "#FF6600", name: "Sunset" },
  { hex: "#2EC4B6", name: "Sea" },
  { hex: "#FF3F8C", name: "Pink" },
  { hex: "#F1C40F", name: "Gold" },
];
// Mini panel mockups — show eyebrow + hero + support + mini calendar in
// each color. Demonstrates how the chosen accent cascades through the real
// rendered surface (minus collabs, which would dominate the swatch).
const ACTIVE_DAYS = [1, 3, 6]; // Mon, Wed, Sat — matches the demo schedule
const colorCardsSvg = colorChips.map((c, i) => {
  const x = i * 156;

  // 7 days × 4 hour rows; cells in active columns get the swatch color
  const cellsSvg = [0, 1, 2, 3]
    .map((row) =>
      [0, 1, 2, 3, 4, 5, 6]
        .map((col) => {
          const cx = col * 16;
          const cy = row * 12;
          const active = ACTIVE_DAYS.includes(col);
          const fill = active ? c.hex : "rgba(255,255,255,0.05)";
          const opacity = active ? 0.85 : 1;
          return `<rect x="${cx}" y="${cy}" width="14" height="10" rx="2" fill="${fill}" fill-opacity="${opacity}"/>`;
        })
        .join("")
    )
    .join("");

  // Header letters — active days highlighted in the swatch color
  const dayLetters = ["S", "M", "T", "W", "T", "F", "S"]
    .map((letter, col) => {
      const cx = col * 16 + 7;
      const fill = ACTIVE_DAYS.includes(col) ? c.hex : "#3a3a3d";
      return `<text x="${cx}" fill="${fill}">${letter}</text>`;
    })
    .join("");

  return `<g transform="translate(${x}, 0)">
    <rect width="140" height="280" rx="14" fill="${c.hex}" fill-opacity="0.08" stroke="${c.hex}" stroke-opacity="0.4" stroke-width="1"/>

    <!-- Eyebrow -->
    <text x="14" y="26" font-family="Segoe UI, Arial, sans-serif" font-size="8" font-weight="700" fill="#6b6b75" letter-spacing="0.12em">NEXT LIKELY LIVE</text>

    <!-- Hero -->
    <text x="14" y="66" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="800" fill="${c.hex}" letter-spacing="-0.04em">Tonight</text>

    <!-- Support -->
    <text x="14" y="86" font-family="Segoe UI, Arial, sans-serif" font-size="9" fill="#adadb8">around <tspan fill="#efeff1" font-weight="700">7 PM</tspan></text>

    <!-- Mini calendar header -->
    <g transform="translate(14, 110)" font-family="Segoe UI, Arial, sans-serif" font-size="7" font-weight="700" letter-spacing="0.06em" text-anchor="middle">
      ${dayLetters}
    </g>

    <!-- Mini calendar cells -->
    <g transform="translate(14, 122)">
      ${cellsSvg}
    </g>

    <!-- Color name + hex -->
    <text x="70" y="232" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="600" fill="#efeff1" text-anchor="middle">${c.name}</text>
    <text x="70" y="252" font-family="ui-monospace, Consolas, monospace" font-size="10" font-weight="500" fill="#6b6b75" text-anchor="middle">${c.hex}</text>
  </g>`;
}).join("");
const colorsSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>${ORBY_DEFS}</defs>
  ${ORBY_BG_1024}
  <text x="60" y="100" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="${INTERFACE_ACCENT}" letter-spacing="0.12em">YOUR COLOR</text>
  <text x="60" y="180" font-family="Segoe UI, Arial, sans-serif" font-size="56" font-weight="800" fill="#efeff1" letter-spacing="-1.8">Pick a color or pull</text>
  <text x="60" y="240" font-family="Segoe UI, Arial, sans-serif" font-size="56" font-weight="800" fill="${INTERFACE_ACCENT}" letter-spacing="-1.8">yours from Twitch.</text>
  <text x="60" y="320" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#adadb8">One click. Cascades through every chip, block, button.</text>
  <g transform="translate(44, 440)">${colorCardsSvg}</g>
</svg>`;
writeFileSync(path.join(outDir, "screenshot-2.png"), renderSvgPng(colorsSvg));
console.log("wrote screenshot-2.png");

// ── 3. Personal intro — "hey I'm Mark, here's why this exists" ──────
// Fetch Mark's Twitch avatar so it embeds as a data URI (resvg can't pull
// remote URLs — needs the bytes inline).
console.log("fetching Mark's avatar…");
const avatarUrl =
  "https://static-cdn.jtvnw.net/jtv_user_pictures/54c170ef-e1d0-463d-adda-922e751ef6b8-profile_image-300x300.png";
const avatarBuf = Buffer.from(await (await fetch(avatarUrl)).arrayBuffer());
const avatarDataUri = `data:image/png;base64,${avatarBuf.toString("base64")}`;

const toolsetTools = [
  "ForgetMeNot",
  "Stream Scenes",
  "ChatBox",
  "Song Requests",
  "Clipline",
  "BRB Player",
  "Death Counter",
  "Emote Rain",
];
// Lay out chips in a single row, centered. Each chip ~110w + 12 gap.
const chipW = 110;
const chipGap = 12;
const chipsTotalW = toolsetTools.length * chipW + (toolsetTools.length - 1) * chipGap;
const chipsStartX = (1024 - chipsTotalW) / 2;
const toolChipsSvg = toolsetTools
  .map((name, i) => {
    const x = i * (chipW + chipGap);
    return `<g transform="translate(${x}, 0)">
      <rect width="${chipW}" height="30" rx="6" fill="#18181b" stroke="${INTERFACE_ACCENT}" stroke-opacity="0.35" stroke-width="1"/>
      <text x="${chipW / 2}" y="20" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#adadb8" text-anchor="middle">${name}</text>
    </g>`;
  })
  .join("");

const introSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>
    ${ORBY_DEFS}
    <clipPath id="avatar-clip">
      <circle cx="110" cy="110" r="110"/>
    </clipPath>
    <filter id="avatar-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="14"/>
      <feOffset dx="0" dy="10" result="off"/>
      <feFlood flood-color="#000000" flood-opacity="0.55"/>
      <feComposite in2="off" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  ${ORBY_BG_1024}

  <!-- Eyebrow -->
  <text x="60" y="100" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="${INTERFACE_ACCENT}" letter-spacing="0.14em">MADE BY DEUTSCHMARK</text>

  <!-- Avatar circle (left) -->
  <g transform="translate(60, 150)" filter="url(#avatar-shadow)">
    <circle cx="110" cy="110" r="113" fill="none" stroke="${INTERFACE_ACCENT}" stroke-width="2" stroke-opacity="0.4"/>
    <image href="${avatarDataUri}" x="0" y="0" width="220" height="220" clip-path="url(#avatar-clip)"/>
  </g>

  <!-- Right column: name + bio + pull-quote + link -->
  <g>
    <text x="320" y="200" font-family="Segoe UI, Arial, sans-serif" font-size="56" font-weight="800" fill="#efeff1" letter-spacing="-1.6">Hey, I'm Mark.</text>

    <text x="320" y="252" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#adadb8">I stream. I built this because the tools I needed</text>
    <text x="320" y="278" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#adadb8">were paywalled, subscription-locked, or designed</text>
    <text x="320" y="304" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#adadb8">to upsell me. So I made my own. For everyone.</text>

    <!-- Pull quote -->
    <text x="320" y="380" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" fill="${INTERFACE_ACCENT}" font-style="italic">"Free. Not free-tier free. Just free."</text>

    <!-- Footer link -->
    <text x="320" y="442" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#6b6b75" letter-spacing="0.02em">Schedule Forecast is one of 19 free tools at</text>
    <text x="320" y="470" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#efeff1">toolset.deutschmark.online <tspan fill="${INTERFACE_ACCENT}">↗</tspan></text>
  </g>

  <!-- Eyebrow above chip row -->
  <text x="60" y="620" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="700" fill="#6b6b75" letter-spacing="0.16em">ALSO IN THE TOOLSET</text>

  <!-- Tool chip strip -->
  <g transform="translate(${chipsStartX}, 645)">${toolChipsSvg}</g>
</svg>`;
writeFileSync(path.join(outDir, "screenshot-3.png"), renderSvgPng(introSvg));
console.log("wrote screenshot-3.png");

// ── 4. Empty / no_data states — bonus, not for dashboard ──────────────
writeFileSync(path.join(outDir, "_capture-empty.png"), panelEmpty);
writeFileSync(path.join(outDir, "_capture-no-data.png"), panelNoData);
console.log("wrote bonus captures (_capture-empty.png, _capture-no-data.png)");

console.log("\nDone — three dashboard screenshots in twitch-extension/assets/");
