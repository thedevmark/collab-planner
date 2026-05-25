// Generate the design-iteration slideshow for the Schedule Forecast
// Twitch panel. 4 slides total, 2 panel mockups per slide showing how
// each iteration grew out of the last.

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

// ── Cache Twitch box art for the v0.9 panel ──────────────────────
const boxArtCacheDir = path.join(outDir, "boxart");
mkdirSync(boxArtCacheDir, { recursive: true });
async function getBoxArtDataUri(gameName) {
  const safe = gameName.replace(/[^a-zA-Z0-9-]/g, "_");
  const cachePath = path.join(boxArtCacheDir, `${safe}.jpg`);
  if (!existsSync(cachePath)) {
    const url = `https://static-cdn.jtvnw.net/ttv-boxart/${encodeURIComponent(gameName)}-285x380.jpg`;
    const res = await fetch(url);
    if (!res.ok) { console.warn(`  ! ${gameName} failed (${res.status})`); return null; }
    writeFileSync(cachePath, Buffer.from(await res.arrayBuffer()));
  }
  return `data:image/jpeg;base64,${readFileSync(cachePath).toString("base64")}`;
}
const BOX_ART_GAMES = ["Apex Legends", "Just Chatting", "Fortnite", "League of Legends"];
const boxArtMap = {};
for (const g of BOX_ART_GAMES) boxArtMap[g] = await getBoxArtDataUri(g);

// ── Visual constants ──────────────────────────────────────────────
// ACCENT is the broadcaster's Twitch profile color (#1D4470). All
// panel mockup highlights + slide chrome (titles, chips) use it.
const ACCENT = "#1D4470";
const TEAL = "#2ec4b6";
const MUTED = "#adadb8";
const SUBTLE = "#6b6b75";
const FG = "#efeff1";
const PANEL_FILL = "#18181b";
const PANEL_STROKE = "#2a2a2e";
const PANEL_W = 380;
const FONT = "Segoe UI, Inter, Arial, sans-serif";

// Orby background — purple halved, sea-green/cyan boosted so the
// page leans more aquatic than Twitch-purple-default.
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

// ── Panel mockups (same as before) ────────────────────────────────

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

function panelV05() {
  const rows = [];
  for (let h = 0; h < 24; h++) {
    const lbl = h % 6 === 0 ? (h === 0 ? "12a" : h === 6 ? "6a" : h === 12 ? "12p" : "6p") : "";
    rows.push(`<g transform="translate(0, ${h*8})"><text font-family="${FONT}" font-size="7" fill="${SUBTLE}" y="6">${lbl}</text>${Array.from({length:7},(_,d)=>{const a=(d===0||d===1||d===3)&&h>=19&&h<=23;return `<rect x="${22+d*42}" y="0" width="40" height="6" rx="1" fill="${ACCENT}" fill-opacity="${a?0.8:0.05}"/>`}).join("")}</g>`);
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
    const a = (d===0||d===1||d===3) && h>=1 && h<=4;
    cells.push(`<rect x="${24+d*46}" y="${h*22}" width="42" height="20" rx="${h===1||h===4?5:2}" fill="${a?ACCENT:"#1f1f23"}" fill-opacity="${a?0.9:1}"/>`);
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

// ── Paired-slide template ─────────────────────────────────────────
// Two panel mockups side by side, big title + lesson copy above.
// Conversational copy — no marketing-listicle staccato.
function pairedSlide({ index, total, leftVer, rightVer, title, lesson, leftPanel, leftHeight, leftCaption, rightPanel, rightHeight, rightCaption }) {
  // Center the two panels horizontally with a 60px gap between them.
  // Bottom-align so different panel heights still sit on the same baseline.
  const baseline = 850;
  const pairWidth = PANEL_W * 2 + 60;
  const leftX = (1600 - pairWidth) / 2;
  const rightX = leftX + PANEL_W + 60;
  const leftY = baseline - leftHeight;
  const rightY = baseline - rightHeight;

  // Lesson wrap: split string on \n
  const lessonLines = lesson.split("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>${SLIDE_DEFS}</defs>
  ${SLIDE_BG}

  <!-- Progress dots top-right -->
  <g transform="translate(1380, 50)">
    ${Array.from({ length: total }, (_, i) => `<circle cx="${i * 22}" cy="0" r="${i + 1 === index ? 6 : 4}" fill="${i + 1 === index ? ACCENT : "#3a3a3d"}"/>`).join("")}
  </g>

  <!-- Two small version chips top-left -->
  <g transform="translate(120, 110)">
    <rect width="68" height="26" rx="13" fill="${ACCENT}" fill-opacity="0.15" stroke="${ACCENT}" stroke-opacity="0.4" stroke-width="1"/>
    <text x="34" y="17" font-family="${FONT}" font-size="12" font-weight="700" fill="${ACCENT}" text-anchor="middle" letter-spacing="0.04em">${leftVer}</text>
  </g>
  <text x="208" y="129" font-family="${FONT}" font-size="14" fill="${SUBTLE}">→</text>
  <g transform="translate(232, 110)">
    <rect width="68" height="26" rx="13" fill="${ACCENT}" fill-opacity="0.15" stroke="${ACCENT}" stroke-opacity="0.4" stroke-width="1"/>
    <text x="34" y="17" font-family="${FONT}" font-size="12" font-weight="700" fill="${ACCENT}" text-anchor="middle" letter-spacing="0.04em">${rightVer}</text>
  </g>

  <!-- Title -->
  <text x="120" y="220" font-family="${FONT}" font-size="58" font-weight="800" fill="${FG}" letter-spacing="-1.5">${title}</text>

  <!-- Lesson body — flows in a single column up to ~1100px wide -->
  <g font-family="${FONT}" font-size="22" font-weight="400" fill="${MUTED}">
    ${lessonLines.map((line, i) => `<text x="120" y="${290 + i * 32}">${line}</text>`).join("")}
  </g>

  <!-- Two panels at the bottom -->
  <g transform="translate(${leftX}, ${leftY})">${leftPanel}</g>
  <g transform="translate(${rightX}, ${rightY})">${rightPanel}</g>

  <!-- Captions under each panel -->
  <text x="${leftX + PANEL_W / 2}" y="${baseline + 28}" font-family="${FONT}" font-size="13" font-weight="600" fill="${SUBTLE}" text-anchor="middle" letter-spacing="0.04em">${leftCaption}</text>
  <text x="${rightX + PANEL_W / 2}" y="${baseline + 28}" font-family="${FONT}" font-size="13" font-weight="600" fill="${SUBTLE}" text-anchor="middle" letter-spacing="0.04em">${rightCaption}</text>
</svg>`;
}

// ── The 4-slide story ─────────────────────────────────────────────
const TOTAL = 4;

// Slide 1 — v0.2 + v0.5: too much, then rotated
render(pairedSlide({
  index: 1, total: TOTAL,
  leftVer: "v0.2", rightVer: "v0.5",
  title: "tried fitting it all in.",
  lesson:
    "stuffed every stat in. heatmap, chips, game, collabs.\n" +
    "rotated the grid to fix density. somehow worse.",
  leftPanel: panelV02(), leftHeight: 360, leftCaption: "everything at once",
  rightPanel: panelV05(), rightHeight: 280, rightCaption: "rotated. still cramped.",
}), path.join(outDir, "01.png"));

// Slide 2 — v0.7 + v0.8: over-corrections
render(pairedSlide({
  index: 2, total: TOTAL,
  leftVer: "v0.7", rightVer: "v0.8",
  title: "overcorrected. twice.",
  lesson:
    "built a real calendar widget. ugly.\n" +
    "stripped it bare. too far the other way.",
  leftPanel: panelV07(), leftHeight: 280, leftCaption: "too literal",
  rightPanel: panelV08(), rightHeight: 240, rightCaption: "too minimal",
}), path.join(outDir, "02.png"));

// Slide 3 — v0.8 + v0.9: brought richness back
render(pairedSlide({
  index: 3, total: TOTAL,
  leftVer: "v0.8", rightVer: "v0.9",
  title: "brought the richness back.",
  lesson:
    "calendar in. recent games in. collabs in.\n" +
    "this time with room to breathe.",
  leftPanel: panelV08(), leftHeight: 240, leftCaption: "stripped",
  rightPanel: panelV09(), rightHeight: 450, rightCaption: "designed",
}), path.join(outDir, "03.png"));

// Slide 4 — v0.2 + v0.9: same data, different feel (punchline)
render(pairedSlide({
  index: 4, total: TOTAL,
  leftVer: "v0.2", rightVer: "v0.9",
  title: "same data. different feel.",
  lesson:
    "every fact thrown at you vs. one answer up front.\n" +
    "the trick wasn't subtracting. it was hierarchy.",
  leftPanel: panelV02(), leftHeight: 360, leftCaption: "where I started",
  rightPanel: panelV09(), rightHeight: 450, rightCaption: "where it landed",
}), path.join(outDir, "04.png"));

console.log(`\nDone — ${TOTAL} slides at ${outDir}`);
