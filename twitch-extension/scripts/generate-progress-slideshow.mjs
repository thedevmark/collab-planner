// Generate a Twitter-sized slideshow (1600x900) documenting the Schedule
// Forecast Twitch extension — feature highlights + design iteration story.
//
// Slide order:
//   00 cover
//   01 — Customizable colors (NEW — Twitch profile color autodetect)
//   02 — Works without signup (concept-only, no screenshot)
//   03 — v0.2 the kitchen sink
//   04 — v0.5 hours on the side
//   05 — v0.7 took the metaphor literally
//   06 — v0.8 subtract everything
//   07 — v0.9 rich + restraint (with real Twitch box art)
//   08 — closing lesson
//
// Run with: node scripts/generate-progress-slideshow.mjs

import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
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

function render(svg, outPath) {
  const png = new Resvg(svg, {
    font: { fontBuffers: interFonts, defaultFontFamily: "Segoe UI", loadSystemFonts: true },
  }).render().asPng();
  writeFileSync(outPath, png);
  console.log("wrote", path.basename(outPath));
}

// ── Cache + embed real Twitch box art for the v0.9 panel ──────────
const boxArtCacheDir = path.join(outDir, "boxart");
mkdirSync(boxArtCacheDir, { recursive: true });

async function getBoxArtDataUri(gameName) {
  const safe = gameName.replace(/[^a-zA-Z0-9-]/g, "_");
  const cachePath = path.join(boxArtCacheDir, `${safe}.jpg`);
  if (!existsSync(cachePath)) {
    const url = `https://static-cdn.jtvnw.net/ttv-boxart/${encodeURIComponent(gameName)}-285x380.jpg`;
    const res = await fetch(url);
    if (!res.ok) { console.warn(`  ! box art failed for ${gameName} (${res.status})`); return null; }
    writeFileSync(cachePath, Buffer.from(await res.arrayBuffer()));
    console.log(`  downloaded ${gameName}`);
  }
  return `data:image/jpeg;base64,${readFileSync(cachePath).toString("base64")}`;
}

const BOX_ART_GAMES = ["Apex Legends", "Just Chatting", "Marvel Rivals", "League of Legends"];
console.log("loading box art…");
const boxArtMap = {};
for (const g of BOX_ART_GAMES) boxArtMap[g] = await getBoxArtDataUri(g);

// ── Visual constants ──────────────────────────────────────────────
const ACCENT = "#9147ff";
const TEAL = "#00c8af";
const MUTED = "#adadb8";
const SUBTLE = "#6b6b75";
const FG = "#efeff1";
const PANEL_FILL = "#18181b";
const PANEL_STROKE = "#2a2a2e";
const PANEL_W = 380;
const FONT = "Segoe UI, Inter, Arial, sans-serif";

// Shared orby background defs + render
const SLIDE_DEFS = `
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
const SLIDE_BG = `
  <rect width="1600" height="900" fill="url(#bg)"/>
  <ellipse cx="200" cy="780" rx="480" ry="380" fill="url(#orb-purple)"/>
  <ellipse cx="1400" cy="150" rx="420" ry="340" fill="url(#orb-teal)"/>
  <ellipse cx="950" cy="850" rx="500" ry="280" fill="url(#orb-blue)"/>
`;

function panelFrame(height, inner) {
  return `<rect width="${PANEL_W}" height="${height}" rx="14" fill="${PANEL_FILL}" stroke="${PANEL_STROKE}" stroke-width="1"/>
    <g transform="translate(20, 24)">${inner}</g>`;
}

// ── Standard slide with title + lesson on left, panel on right ────
function slide({ index, total, version, title, lesson, panelSvg, panelHeight = 360 }) {
  const panelTop = Math.max(140, Math.round((900 - panelHeight) / 2));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>${SLIDE_DEFS}</defs>
  ${SLIDE_BG}
  <g transform="translate(1380, 50)">
    ${Array.from({ length: total }, (_, i) => `<circle cx="${i * 18}" cy="0" r="${i + 1 === index ? 5 : 3}" fill="${i + 1 === index ? ACCENT : "#3a3a3d"}"/>`).join("")}
  </g>
  <g transform="translate(120, 110)">
    <rect width="80" height="28" rx="14" fill="${ACCENT}" fill-opacity="0.15" stroke="${ACCENT}" stroke-opacity="0.4" stroke-width="1"/>
    <text x="40" y="18" font-family="${FONT}" font-size="13" font-weight="700" fill="${ACCENT}" text-anchor="middle" letter-spacing="0.04em">${version}</text>
  </g>
  <text x="120" y="240" font-family="${FONT}" font-size="64" font-weight="800" fill="${FG}" letter-spacing="-2">${title}</text>
  <g font-family="${FONT}" font-size="22">
    ${lesson.split("\n").map((line, i) => `<text x="120" y="${320 + i * 36}" font-weight="${i === 0 ? "500" : "400"}" fill="${i === 0 ? FG : MUTED}">${line}</text>`).join("")}
  </g>
  <g transform="translate(1050, ${panelTop})">${panelSvg}</g>
</svg>`;
}

// ── Panel mockups ─────────────────────────────────────────────────

function panelV02() {
  const cells = [];
  for (let day = 0; day < 7; day++) for (let hr = 0; hr < 24; hr++) {
    const active = (day === 0 || day === 1 || day === 3) && hr >= 19 && hr <= 23;
    cells.push(`<rect x="${hr * 13}" y="${day * 9}" width="11" height="7" rx="1" fill="${ACCENT}" fill-opacity="${active ? 0.7 : 0.06}"/>`);
  }
  return panelFrame(360, `
    <text x="0" y="0" font-family="${FONT}" font-size="14" font-weight="500" fill="${MUTED}">↗ Streams Sun, Mon, Wed ~10PM EDT</text>
    <g transform="translate(0, 22)">${["S","M","T","W","T","F","S"].map((d, i) => `<rect x="${i*38}" y="0" width="32" height="22" rx="3" fill="${[0,1,3].includes(i) ? ACCENT : "#2a2a2e"}"/><text x="${i*38+16}" y="15" font-family="${FONT}" font-size="11" font-weight="700" fill="${[0,1,3].includes(i) ? "#fff" : SUBTLE}" text-anchor="middle">${d}</text>`).join("")}</g>
    <g transform="translate(0, 60)"><text font-family="${FONT}" font-size="10" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">WEEKLY HEATMAP</text><g transform="translate(0, 12)">${cells.join("")}</g></g>
    <g transform="translate(0, 160)"><text font-family="${FONT}" font-size="10" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">LAST LIVE</text><text y="20" font-family="${FONT}" font-size="13" fill="${FG}">2d ago · Apex Legends · 4h</text></g>
    <g transform="translate(0, 210)"><text font-family="${FONT}" font-size="10" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">UPCOMING COLLABS</text><text y="22" font-family="${FONT}" font-size="13" fill="${FG}">Sat 6PM with @alice +1</text><text y="40" font-family="${FONT}" font-size="13" fill="${FG}">Apex Legends</text></g>
  `);
}

function panelV05() {
  const rows = [];
  for (let h = 0; h < 24; h++) {
    const lbl = h % 6 === 0 ? (h === 0 ? "12a" : h === 6 ? "6a" : h === 12 ? "12p" : "6p") : "";
    rows.push(`<g transform="translate(0, ${h * 8})"><text font-family="${FONT}" font-size="7" fill="${SUBTLE}" y="6">${lbl}</text>${Array.from({length:7},(_,d)=>{const a=(d===0||d===1||d===3)&&h>=19&&h<=23;return `<rect x="${22+d*42}" y="0" width="40" height="6" rx="1" fill="${ACCENT}" fill-opacity="${a?0.8:0.05}"/>`}).join("")}</g>`);
  }
  return panelFrame(280, `
    <text font-family="${FONT}" font-size="14" font-weight="500" fill="${MUTED}">↗ Streams Sun, Mon, Wed ~10PM</text>
    <g transform="translate(0, 24)">${["S","M","T","W","T","F","S"].map((d,i)=>`<text x="${42+i*42}" font-family="${FONT}" font-size="10" font-weight="700" fill="${MUTED}" text-anchor="middle">${d}</text>`).join("")}</g>
    <g transform="translate(0, 36)">${rows.join("")}</g>
  `);
}

function panelV07() {
  const cells = [];
  const hours = ["10p","11p","12a","1a","2a","3a"];
  for (let h = 0; h < hours.length; h++) for (let d = 0; d < 7; d++) {
    const active = (d===0||d===1||d===3) && h>=1 && h<=4;
    cells.push(`<rect x="${24+d*46}" y="${h*22}" width="42" height="20" rx="${h===1||h===4?5:2}" fill="${active?ACCENT:"#1f1f23"}" fill-opacity="${active?0.9:1}"/>`);
  }
  return panelFrame(280, `
    <text font-family="${FONT}" font-size="10" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">SCHEDULE</text>
    <g transform="translate(0, 16)"><text y="32" font-family="${FONT}" font-size="44" font-weight="800" fill="${ACCENT}">~11<tspan font-size="22">PM</tspan></text><text y="52" font-family="${FONT}" font-size="11" fill="${SUBTLE}">Eastern Daylight Time</text></g>
    <g transform="translate(0, 90)">${["S","M","T","W","T","F","S"].map((d,i)=>`<text x="${45+i*46}" font-family="${FONT}" font-size="10" font-weight="700" fill="${[0,1,3].includes(i)?FG:SUBTLE}" text-anchor="middle">${d}</text>`).join("")}</g>
    <g transform="translate(0, 10)">${hours.map((l,i)=>`<text y="${118+i*22}" font-family="${FONT}" font-size="9" fill="${SUBTLE}">${l}</text>`).join("")}<g transform="translate(0, 108)">${cells.join("")}</g></g>
  `);
}

function panelV08() {
  return panelFrame(240, `
    <text font-family="${FONT}" font-size="12" fill="${MUTED}">Sun · Tue · Mon <tspan fill="${TEAL}">●</tspan></text>
    <text y="60" font-family="${FONT}" font-size="48" font-weight="800" fill="${ACCENT}" letter-spacing="-0.04em">~11<tspan font-size="22">PM</tspan></text>
    <text y="80" font-family="${FONT}" font-size="11" fill="${SUBTLE}">Eastern Daylight Time</text>
    <g transform="translate(0, 110)">${["S","M","T","W","T","F","S"].map((d,i)=>`<text x="${i*50}" font-family="${FONT}" font-size="12" font-weight="700" fill="${[0,1,3].includes(i)?ACCENT:"#3a3a3d"}" text-anchor="middle">${d}</text>`).join("")}</g>
    <text y="160" font-family="${FONT}" font-size="10" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">NEXT COLLAB <tspan font-weight="600" fill="${FG}">Sat 6 PM</tspan></text>
    <text x="170" y="220" font-family="${FONT}" font-size="10" fill="${SUBTLE}" text-anchor="middle">Powered by Collab Planner</text>
  `);
}

function panelV09() {
  const calCells = [];
  const labels = ["10p","11p","12a","1a","2a","3a"];
  for (let h = 0; h < labels.length; h++) for (let d = 0; d < 7; d++) {
    const a = (d===0||d===1||d===3) && h>=1 && h<=4;
    calCells.push(`<rect x="${22+d*44}" y="${h*18}" width="40" height="16" rx="${h===1||h===4?4:1}" fill="${a?ACCENT:"#1f1f23"}" fill-opacity="${a?0.95:1}"/>`);
  }
  const tiles = BOX_ART_GAMES.map((g, i) => {
    const uri = boxArtMap[g];
    if (!uri) return `<rect x="${i*70}" y="10" width="60" height="80" rx="4" fill="#2a2a2e"/>`;
    return `<g transform="translate(${i*70}, 10)"><clipPath id="ba-${i}"><rect width="60" height="80" rx="4"/></clipPath><image href="${uri}" width="60" height="80" preserveAspectRatio="xMidYMid slice" clip-path="url(#ba-${i})"/></g>`;
  }).join("");

  return panelFrame(450, `
    <text font-family="${FONT}" font-size="9" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">NEXT LIKELY LIVE <tspan fill="${TEAL}">●</tspan></text>
    <text y="22" font-family="${FONT}" font-size="14" font-weight="600" fill="${FG}">Monday <tspan fill="${MUTED}" font-weight="400" font-size="11">· tonight</tspan></text>
    <text y="60" font-family="${FONT}" font-size="42" font-weight="800" fill="${ACCENT}" letter-spacing="-0.04em"><tspan font-size="18" fill-opacity="0.5">~</tspan>11<tspan font-size="18" fill-opacity="0.85">PM</tspan></text>
    <text y="78" font-family="${FONT}" font-size="10" fill="${SUBTLE}">Eastern Daylight Time</text>

    <g transform="translate(0, 100)">
      ${["S","M","T","W","T","F","S"].map((d,i)=>`<text x="${43+i*44}" font-family="${FONT}" font-size="10" font-weight="700" fill="${[0,1,3].includes(i)?ACCENT:"#3a3a3d"}" text-anchor="middle">${d}</text>`).join("")}
      ${labels.map((l,i)=>`<text x="0" y="${24+i*18+11}" font-family="${FONT}" font-size="8" fill="${SUBTLE}">${l}</text>`).join("")}
      <g transform="translate(0, 14)">${calCells.join("")}</g>
    </g>

    <g transform="translate(0, 230)">
      <text font-family="${FONT}" font-size="9" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">RECENTLY PLAYED</text>
      ${tiles}
    </g>

    <text y="345" font-family="${FONT}" font-size="10" fill="${SUBTLE}">Last live: 2d ago · 5h duration</text>

    <g transform="translate(0, 365)">
      <text font-family="${FONT}" font-size="9" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">UPCOMING COLLABS</text>
      <text y="18" font-family="${FONT}" font-size="11" fill="${FG}">Sat 6PM <tspan fill="${MUTED}">with </tspan>@alice, @bob</text>
      <text y="36" font-family="${FONT}" font-size="11" fill="${FG}">Tue 8PM <tspan fill="${MUTED}">with </tspan>@carl · Marvel Rivals</text>
    </g>
  `);
}

// ── Feature slides (no version badge, full-bleed concept) ─────────

// Slide #2 — Color customization: shows 6 panel mini-cards each in a
// different accent color + the "Use my Twitch profile color" button.
function colorSlide({ index, total }) {
  const colors = [
    { hex: "#9146FF", name: "Twitch Purple" },
    { hex: "#FF6600", name: "Sunset" },
    { hex: "#00C8AF", name: "Mint" },
    { hex: "#FF3F8C", name: "Pink" },
    { hex: "#3A7BFF", name: "Sky" },
    { hex: "#F1C40F", name: "Gold" },
  ];
  const cards = colors.map((c, i) => {
    const x = (i % 3) * 230;
    const y = Math.floor(i / 3) * 200;
    return `<g transform="translate(${x}, ${y})">
      <rect width="200" height="170" rx="10" fill="${PANEL_FILL}" stroke="${PANEL_STROKE}"/>
      <g transform="translate(16, 18)">
        <text font-family="${FONT}" font-size="9" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">NEXT LIVE</text>
        <text y="38" font-family="${FONT}" font-size="32" font-weight="800" fill="${c.hex}" letter-spacing="-0.04em">~11<tspan font-size="14">PM</tspan></text>
        <text y="56" font-family="${FONT}" font-size="9" fill="${SUBTLE}">Eastern Time</text>
        <g transform="translate(0, 76)">
          ${["S","M","T","W","T","F","S"].map((d, j) => `<text x="${j*24}" font-family="${FONT}" font-size="11" font-weight="700" fill="${[0,1,3].includes(j) ? c.hex : "#3a3a3d"}" text-anchor="middle">${d}</text>`).join("")}
        </g>
        <g transform="translate(0, 96)">
          ${[0, 1, 3].map((d) => `<rect x="${d*24-8}" y="0" width="16" height="22" rx="3" fill="${c.hex}" fill-opacity="0.9"/>`).join("")}
        </g>
        <text y="146" font-family="${FONT}" font-size="9" font-weight="600" fill="${MUTED}" letter-spacing="0.02em">${c.name}</text>
        <text x="160" y="146" font-family="ui-monospace, Consolas, monospace" font-size="8" font-weight="500" fill="${SUBTLE}" text-anchor="end">${c.hex}</text>
      </g>
    </g>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>${SLIDE_DEFS}</defs>
  ${SLIDE_BG}
  <g transform="translate(1380, 50)">
    ${Array.from({ length: total }, (_, i) => `<circle cx="${i * 18}" cy="0" r="${i + 1 === index ? 5 : 3}" fill="${i + 1 === index ? ACCENT : "#3a3a3d"}"/>`).join("")}
  </g>

  <text x="120" y="200" font-family="${FONT}" font-size="22" font-weight="700" fill="${ACCENT}" letter-spacing="0.12em">YOUR COLOR. YOUR PANEL.</text>
  <text x="120" y="290" font-family="${FONT}" font-size="68" font-weight="800" fill="${FG}" letter-spacing="-2">Pick any accent.</text>
  <text x="120" y="365" font-family="${FONT}" font-size="68" font-weight="800" fill="${FG}" letter-spacing="-2">Or auto-pull yours</text>
  <text x="120" y="440" font-family="${FONT}" font-size="68" font-weight="800" fill="${ACCENT}" letter-spacing="-2">from Twitch.</text>

  <g font-family="${FONT}" font-size="20" fill="${MUTED}">
    <text x="120" y="510">One-click "Use my Twitch profile color" pulls</text>
    <text x="120" y="540">your channel's accent straight from your account.</text>
    <text x="120" y="585" font-size="18" fill="${SUBTLE}">Or paste any hex. Color cascades through every chip,</text>
    <text x="120" y="610" font-size="18" fill="${SUBTLE}">block, link, and button — instantly.</text>
  </g>

  <!-- The 6 color swatch panels on the right -->
  <g transform="translate(900, 200)">${cards}</g>
</svg>`;
}

// Slide #3 — Works without signup, concept-only (no real screenshot)
function noSignupSlide({ index, total }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>${SLIDE_DEFS}</defs>
  ${SLIDE_BG}
  <g transform="translate(1380, 50)">
    ${Array.from({ length: total }, (_, i) => `<circle cx="${i * 18}" cy="0" r="${i + 1 === index ? 5 : 3}" fill="${i + 1 === index ? ACCENT : "#3a3a3d"}"/>`).join("")}
  </g>

  <text x="120" y="200" font-family="${FONT}" font-size="22" font-weight="700" fill="${TEAL}" letter-spacing="0.12em">NO ACCOUNT NEEDED</text>
  <text x="120" y="290" font-family="${FONT}" font-size="72" font-weight="800" fill="${FG}" letter-spacing="-2">Works the moment</text>
  <text x="120" y="370" font-family="${FONT}" font-size="72" font-weight="800" fill="${FG}" letter-spacing="-2">you install it.</text>

  <g font-family="${FONT}" font-size="22" fill="${MUTED}">
    <text x="120" y="465">Predictions auto-build from your channel's</text>
    <text x="120" y="500">public broadcast history. Zero setup.</text>
    <text x="120" y="565" font-size="18" fill="${SUBTLE}">Sign in at collab.deutschmark.online to add planned</text>
    <text x="120" y="590" font-size="18" fill="${SUBTLE}">collabs, schedule sync, and sharper signal — totally optional.</text>
  </g>

  <!-- Concept diagram: 3 stage flow → install → predictions live → sign-in optional -->
  <g transform="translate(820, 280)">
    <!-- Stage 1: Install -->
    <g transform="translate(0, 0)">
      <rect width="220" height="200" rx="16" fill="${PANEL_FILL}" stroke="${PANEL_STROKE}" stroke-width="1"/>
      <circle cx="110" cy="70" r="34" fill="${ACCENT}" fill-opacity="0.15" stroke="${ACCENT}" stroke-width="1.5"/>
      <text x="110" y="79" font-family="${FONT}" font-size="32" font-weight="700" fill="${ACCENT}" text-anchor="middle">1</text>
      <text x="110" y="135" font-family="${FONT}" font-size="16" font-weight="700" fill="${FG}" text-anchor="middle">Install</text>
      <text x="110" y="158" font-family="${FONT}" font-size="12" fill="${MUTED}" text-anchor="middle">on your channel</text>
      <text x="110" y="178" font-family="${FONT}" font-size="12" fill="${MUTED}" text-anchor="middle">from Twitch</text>
    </g>

    <!-- Arrow -->
    <text x="245" y="115" font-family="${FONT}" font-size="32" fill="${SUBTLE}">→</text>

    <!-- Stage 2: Live -->
    <g transform="translate(280, 0)">
      <rect width="220" height="200" rx="16" fill="${TEAL}" fill-opacity="0.08" stroke="${TEAL}" stroke-width="1.5"/>
      <circle cx="110" cy="70" r="34" fill="${TEAL}" fill-opacity="0.2" stroke="${TEAL}" stroke-width="1.5"/>
      <text x="110" y="79" font-family="${FONT}" font-size="32" font-weight="700" fill="${TEAL}" text-anchor="middle">✓</text>
      <text x="110" y="135" font-family="${FONT}" font-size="16" font-weight="700" fill="${FG}" text-anchor="middle">Panel is live</text>
      <text x="110" y="158" font-family="${FONT}" font-size="12" fill="${MUTED}" text-anchor="middle">predictions from your</text>
      <text x="110" y="178" font-family="${FONT}" font-size="12" fill="${MUTED}" text-anchor="middle">broadcast history</text>
    </g>

    <!-- Arrow -->
    <text x="525" y="115" font-family="${FONT}" font-size="32" fill="${SUBTLE}">→</text>

    <!-- Stage 3: Optional sign-in -->
    <g transform="translate(560, 0)">
      <rect width="220" height="200" rx="16" fill="${PANEL_FILL}" stroke="${PANEL_STROKE}" stroke-dasharray="4 4" stroke-width="1"/>
      <circle cx="110" cy="70" r="34" fill="${PANEL_FILL}" stroke="${SUBTLE}" stroke-width="1.5"/>
      <text x="110" y="80" font-family="${FONT}" font-size="22" font-weight="700" fill="${SUBTLE}" text-anchor="middle">+</text>
      <text x="110" y="135" font-family="${FONT}" font-size="14" font-weight="700" fill="${MUTED}" text-anchor="middle">Sign in</text>
      <text x="110" y="155" font-family="${FONT}" font-size="11" fill="${SUBTLE}" text-anchor="middle">(optional)</text>
      <text x="110" y="178" font-family="${FONT}" font-size="11" fill="${SUBTLE}" text-anchor="middle">for collabs + sync</text>
    </g>
  </g>
</svg>`;
}

// ── Build the slideshow ───────────────────────────────────────────
const iterationSlides = [
  { version: "v0.2", title: "The kitchen sink.", lesson: "Heatmap. Day chips. Game tag. Collab list.\nEvery stat I could compute, all at once.\nFelt like a dashboard, not a product.", panel: panelV02(), height: 360 },
  { version: "v0.5", title: "Hours on the side.", lesson: "User: \"hours should be on side not on top.\"\nRotated the grid 90°. Made it WORSE —\n24 thin rows in 300px = cramped soup.", panel: panelV05(), height: 280 },
  { version: "v0.7", title: "Took the metaphor literally.", lesson: "User asked for \"a calendar-style week view.\"\nBuilt an actual grid widget with event blocks.\nUser: \"still ugly and small.\"", panel: panelV07(), height: 280 },
  { version: "v0.8", title: "Subtract everything.", lesson: "Dispatched a fresh-eyes agent to audit.\nIt told me: \"every round you've been asked\nto SUBTRACT.\" Cut the heatmap. Last live.\nGame chip. Down to just the hero.\nUser: \"I said BEAUTIFUL, not minimal.\"", panel: panelV08(), height: 240 },
  { version: "v0.9", title: "Rich + restraint.", lesson: "The synthesis. Polished apps aren't minimal —\nthey're rich, elegantly arranged.\nBrought back the calendar, the recent games,\nthe collabs. Reframed hero as \"next live.\"\nDesigned restraint, not stripped restraint.", panel: panelV09(), height: 450 },
];

// 1 cover + 1 color slide + 1 no-signup slide + 5 iterations + 1 closing = 9
const TOTAL = 1 + 1 + 1 + iterationSlides.length + 1;

// Cover (slide 1 of TOTAL)
const cover = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>${SLIDE_DEFS}</defs>
  ${SLIDE_BG}
  <g transform="translate(120, 290)">
    <text font-family="${FONT}" font-size="22" font-weight="600" fill="${ACCENT}" letter-spacing="0.16em">A TWITCH EXTENSION</text>
    <text y="100" font-family="${FONT}" font-size="108" font-weight="800" fill="${FG}" letter-spacing="-3">Schedule</text>
    <text y="220" font-family="${FONT}" font-size="108" font-weight="800" fill="${FG}" letter-spacing="-3">Forecast.</text>
    <text y="320" font-family="${FONT}" font-size="22" font-weight="400" fill="${MUTED}">A live-time prediction panel for any Twitch channel.</text>
    <text y="354" font-family="${FONT}" font-size="22" font-weight="500" fill="${ACCENT}">Powered by collab.deutschmark.online</text>
  </g>
</svg>`;
render(cover, path.join(outDir, "00-cover.png"));

// Slide 2 — color customization
render(colorSlide({ index: 2, total: TOTAL }), path.join(outDir, "01-colors.png"));

// Slide 3 — works without signup, concept-only
render(noSignupSlide({ index: 3, total: TOTAL }), path.join(outDir, "02-no-signup.png"));

// Slides 4-8 — iteration story
iterationSlides.forEach((s, i) => {
  const svg = slide({
    index: 4 + i,
    total: TOTAL,
    version: s.version,
    title: s.title,
    lesson: s.lesson,
    panelSvg: s.panel,
    panelHeight: s.height,
  });
  render(svg, path.join(outDir, `${String(3 + i).padStart(2, "0")}-${s.version.replace(".", "_")}.png`));
});

// Slide 9 — closing lesson
const closing = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>${SLIDE_DEFS}</defs>
  ${SLIDE_BG}
  <g transform="translate(1380, 50)">
    ${Array.from({ length: TOTAL }, (_, i) => `<circle cx="${i * 18}" cy="0" r="${i + 1 === TOTAL ? 5 : 3}" fill="${i + 1 === TOTAL ? ACCENT : "#3a3a3d"}"/>`).join("")}
  </g>
  <g transform="translate(120, 280)">
    <text font-family="${FONT}" font-size="22" font-weight="600" fill="${ACCENT}" letter-spacing="0.16em">THE LESSON</text>
    <text y="100" font-family="${FONT}" font-size="72" font-weight="800" fill="${FG}" letter-spacing="-2">A reference to a "calendar"</text>
    <text y="185" font-family="${FONT}" font-size="72" font-weight="800" fill="${FG}" letter-spacing="-2">didn't mean build a widget.</text>
    <text y="290" font-family="${FONT}" font-size="72" font-weight="800" fill="${ACCENT}" letter-spacing="-2">It meant restraint with richness.</text>
    <text y="400" font-family="${FONT}" font-size="26" font-weight="400" fill="${MUTED}">Great products are dense with information,</text>
    <text y="438" font-family="${FONT}" font-size="26" font-weight="400" fill="${MUTED}">but every element earned its place.</text>
  </g>
</svg>`;
render(closing, path.join(outDir, `${String(TOTAL - 1).padStart(2, "0")}-lesson.png`));

console.log(`\nDone — ${TOTAL} slides at ${outDir}`);
