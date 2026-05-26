// One 1600x900 image: v0.2 SVG mockup on the left, real shipped panel
// (_capture-empty.png) on the right. For a "started here. shipped here."
// social post — much simplified vs the 4-slide deck.

import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const outDir = path.resolve(here, "..", "assets", "progress");
mkdirSync(outDir, { recursive: true });

const interDir = path.join(repoRoot, "node_modules/@fontsource/inter/files");
const interFonts = [400, 500, 600, 700, 800].map((w) =>
  readFileSync(path.join(interDir, `inter-latin-${w}-normal.woff2`))
);

const ACCENT = "#1D4470";
const MUTED = "#adadb8";
const SUBTLE = "#6b6b75";
const FG = "#efeff1";
const PANEL_FILL = "#18181b";
const PANEL_STROKE = "#2a2a2e";
const PANEL_W = 380;
const FONT = "Segoe UI, Inter, Arial, sans-serif";

const SLIDE_DEFS = `
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
const SLIDE_BG = `
  <rect width="1600" height="900" fill="url(#bg)"/>
  <ellipse cx="1400" cy="150" rx="500" ry="380" fill="url(#orb-cyan)"/>
  <ellipse cx="200" cy="780" rx="480" ry="380" fill="url(#orb-teal)"/>
  <ellipse cx="950" cy="850" rx="500" ry="280" fill="url(#orb-blue)"/>
  <ellipse cx="700" cy="200" rx="300" ry="240" fill="url(#orb-purple)"/>
`;

function panelFrame(height, inner) {
  return `<rect width="${PANEL_W}" height="${height}" rx="14" fill="${PANEL_FILL}" stroke="${PANEL_STROKE}" stroke-width="1"/>
    <g transform="translate(20, 24)">${inner}</g>`;
}

// v0.2 — the original stat-dump mockup. Lifted from generate-progress-slideshow.mjs.
function panelV02() {
  const cells = [];
  for (let day = 0; day < 7; day++) for (let hr = 0; hr < 24; hr++) {
    const a = (day === 0 || day === 1 || day === 3) && hr >= 19 && hr <= 23;
    cells.push(`<rect x="${hr*13}" y="${day*9}" width="11" height="7" rx="1" fill="${ACCENT}" fill-opacity="${a?0.7:0.06}"/>`);
  }
  return panelFrame(360, `
    <text font-family="${FONT}" font-size="14" font-weight="500" fill="${MUTED}">↗ Streams Sun, Mon, Wed ~10PM EDT</text>
    <g transform="translate(0, 22)">${["S","M","T","W","T","F","S"].map((d,i)=>`<rect x="${i*38}" y="0" width="32" height="22" rx="3" fill="${[0,1,3].includes(i)?ACCENT:"#2a2a2e"}"/><text x="${i*38+16}" y="15" font-family="${FONT}" font-size="11" font-weight="700" fill="${[0,1,3].includes(i)?"#fff":SUBTLE}" text-anchor="middle">${d}</text>`).join("")}</g>
    <g transform="translate(0, 60)"><text font-family="${FONT}" font-size="10" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">WEEKLY HEATMAP</text><g transform="translate(0, 12)">${cells.join("")}</g></g>
    <g transform="translate(0, 160)"><text font-family="${FONT}" font-size="10" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">LAST LIVE</text><text y="20" font-family="${FONT}" font-size="13" fill="${FG}">2d ago · Apex Legends · 4h</text></g>
    <g transform="translate(0, 210)"><text font-family="${FONT}" font-size="10" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">UPCOMING COLLABS</text><text y="22" font-family="${FONT}" font-size="13" fill="${FG}">Sat 6PM with @alice +1</text><text y="40" font-family="${FONT}" font-size="13" fill="${FG}">Apex Legends</text></g>
  `);
}

const realPanelPath = path.resolve(here, "..", "assets", "_capture-empty.png");
const realPanelDataUri = `data:image/png;base64,${readFileSync(realPanelPath).toString("base64")}`;
const REAL_W = 340;
const REAL_H = 540;

const LEFT_H = 360;
const RIGHT_H = REAL_H;
const GAP = 100;
const baseline = 800;
const pairWidth = PANEL_W + GAP + REAL_W;
const leftX = (1600 - pairWidth) / 2;
const rightX = leftX + PANEL_W + GAP;
const leftY = baseline - LEFT_H;
const rightY = baseline - RIGHT_H;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>${SLIDE_DEFS}</defs>
  ${SLIDE_BG}

  <text x="800" y="140" font-family="${FONT}" font-size="56" font-weight="800" fill="${FG}" letter-spacing="-1.4" text-anchor="middle">started here. shipped here.</text>

  <g transform="translate(${leftX}, ${leftY})">${panelV02()}</g>
  <image x="${rightX}" y="${rightY}" width="${REAL_W}" height="${REAL_H}" href="${realPanelDataUri}"/>

  <text x="${leftX + PANEL_W / 2}" y="${baseline + 36}" font-family="${FONT}" font-size="16" font-weight="500" fill="${SUBTLE}" text-anchor="middle">v0.2 — first sketch</text>
  <text x="${rightX + REAL_W / 2}" y="${baseline + 36}" font-family="${FONT}" font-size="16" font-weight="500" fill="${SUBTLE}" text-anchor="middle">v1.0.1 — shipped</text>
</svg>`;

const outPath = path.join(outDir, "before-after.png");
const png = new Resvg(svg, {
  font: { fontBuffers: interFonts, defaultFontFamily: "Segoe UI", loadSystemFonts: true },
}).render().asPng();
writeFileSync(outPath, png);
console.log("wrote", outPath);
