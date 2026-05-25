// Generate a Twitter-sized slideshow (1600x900) documenting the design
// iteration journey across panel versions. Each slide is one milestone
// with a simplified SVG panel mockup + lesson text.
//
// Run with: node scripts/generate-progress-slideshow.mjs
// Outputs PNG slides into twitch-extension/assets/progress/

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

function render(svg, outPath) {
  const png = new Resvg(svg, {
    font: {
      fontBuffers: interFonts,
      defaultFontFamily: "Segoe UI",
      loadSystemFonts: true,
    },
  }).render().asPng();
  writeFileSync(outPath, png);
  console.log("wrote", path.basename(outPath));
}

// Shared slide chrome — dark purple-tinted background, title block on left,
// panel-shaped column on right.
function slide({ index, total, version, title, lesson, panelSvg }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d0518"/>
      <stop offset="100%" stop-color="#1a0a2e"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>

  <!-- Progress dots top-right -->
  <g transform="translate(1380, 50)">
    ${Array.from({ length: total }, (_, i) => `
      <circle cx="${i * 18}" cy="0" r="${i + 1 === index ? 5 : 3}" fill="${i + 1 === index ? "#9147ff" : "#3a3a3d"}"/>
    `).join("")}
  </g>

  <!-- Version badge top-left -->
  <g transform="translate(120, 110)">
    <rect width="80" height="28" rx="14" fill="#9147ff" fill-opacity="0.15" stroke="#9147ff" stroke-opacity="0.4" stroke-width="1"/>
    <text x="40" y="18" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="13" font-weight="700" fill="#9147ff" text-anchor="middle" letter-spacing="0.04em">${version}</text>
  </g>

  <!-- Title -->
  <text x="120" y="240" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="64" font-weight="800" fill="#efeff1" letter-spacing="-2">${title}</text>

  <!-- Lesson body text — supports up to 5 lines -->
  <g font-family="Segoe UI, Inter, Arial, sans-serif" font-size="22" fill="#adadb8">
    ${lesson.split("\n").map((line, i) => `
      <text x="120" y="${320 + i * 36}" font-weight="${i === 0 ? "500" : "400"}" fill="${i === 0 ? "#efeff1" : "#adadb8"}">${line}</text>
    `).join("")}
  </g>

  <!-- Panel column on the right -->
  <g transform="translate(1050, 140)">
    ${panelSvg}
  </g>
</svg>`;
}

// ── Helpers for the simplified panel mockups (rough visual likeness) ──
const PANEL_W = 380;
const PANEL_FILL = "#18181b";
const PANEL_STROKE = "#2a2a2e";
const ACCENT = "#9147ff";
const MUTED = "#adadb8";
const SUBTLE = "#6b6b75";

function panelFrame(height, inner) {
  return `
    <rect width="${PANEL_W}" height="${height}" rx="14" fill="${PANEL_FILL}" stroke="${PANEL_STROKE}" stroke-width="1"/>
    <g transform="translate(20, 24)">${inner}</g>
  `;
}

// v0.2 — kitchen sink: chips row + heatmap grid + last-live + collab list
function panelV02() {
  const cells = [];
  for (let day = 0; day < 7; day++) {
    for (let hr = 0; hr < 24; hr++) {
      const x = hr * 13;
      const y = day * 9;
      const active = (day === 0 || day === 1 || day === 3) && hr >= 19 && hr <= 23;
      cells.push(`<rect x="${x}" y="${y}" width="11" height="7" rx="1" fill="${ACCENT}" fill-opacity="${active ? 0.7 : 0.06}"/>`);
    }
  }
  const inner = `
    <text x="0" y="0" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="14" font-weight="500" fill="${MUTED}">↗ Streams Sun, Mon, Wed ~10PM EDT</text>
    <g transform="translate(0, 22)">
      ${["S", "M", "T", "W", "T", "F", "S"].map((d, i) => `
        <rect x="${i * 38}" y="0" width="32" height="22" rx="3" fill="${[0, 1, 3].includes(i) ? ACCENT : "#2a2a2e"}"/>
        <text x="${i * 38 + 16}" y="15" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="11" font-weight="700" fill="${[0, 1, 3].includes(i) ? "#fff" : SUBTLE}" text-anchor="middle">${d}</text>
      `).join("")}
    </g>
    <g transform="translate(0, 60)">
      <text x="0" y="0" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">WEEKLY HEATMAP</text>
      <g transform="translate(0, 12)">${cells.join("")}</g>
    </g>
    <g transform="translate(0, 160)">
      <text x="0" y="0" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">LAST LIVE</text>
      <text x="0" y="20" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="13" fill="#efeff1">2d ago · Apex Legends · 4h</text>
    </g>
    <g transform="translate(0, 210)">
      <text x="0" y="0" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">UPCOMING COLLABS</text>
      <text x="0" y="22" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="13" fill="#efeff1">Sat 6PM with @alice +1</text>
      <text x="0" y="22" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="13" fill="#efeff1" transform="translate(0, 18)">Apex Legends</text>
    </g>
  `;
  return panelFrame(360, inner);
}

// v0.5 — transposed heatmap: hours running down, days across. Cramped.
function panelV05() {
  const rows = [];
  for (let h = 0; h < 24; h++) {
    const showLabel = h % 6 === 0;
    rows.push(`
      <g transform="translate(0, ${h * 8})">
        <text x="0" y="6" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="7" fill="${SUBTLE}">${showLabel ? (h === 0 ? "12a" : h === 6 ? "6a" : h === 12 ? "12p" : h === 18 ? "6p" : "") : ""}</text>
        ${Array.from({ length: 7 }, (_, d) => {
          const active = (d === 0 || d === 1 || d === 3) && h >= 19 && h <= 23;
          return `<rect x="${22 + d * 42}" y="0" width="40" height="6" rx="1" fill="${ACCENT}" fill-opacity="${active ? 0.8 : 0.05}"/>`;
        }).join("")}
      </g>
    `);
  }
  const inner = `
    <text x="0" y="0" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="14" font-weight="500" fill="${MUTED}">↗ Streams Sun, Mon, Wed ~10PM</text>
    <g transform="translate(0, 24)">
      ${["S", "M", "T", "W", "T", "F", "S"].map((d, i) => `
        <text x="${42 + i * 42}" y="0" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" font-weight="700" fill="${MUTED}" text-anchor="middle">${d}</text>
      `).join("")}
    </g>
    <g transform="translate(0, 36)">${rows.join("")}</g>
  `;
  return panelFrame(280, inner);
}

// v0.7 — iOS calendar week-view, focused 6-hour window with event blocks
function panelV07() {
  const cells = [];
  const visibleHours = ["10p", "11p", "12a", "1a", "2a", "3a"];
  for (let h = 0; h < visibleHours.length; h++) {
    for (let d = 0; d < 7; d++) {
      const active = (d === 0 || d === 1 || d === 3) && h >= 1 && h <= 4;
      cells.push(`<rect x="${24 + d * 46}" y="${h * 22}" width="42" height="20" rx="${h === 1 || h === 4 ? 5 : 2}" fill="${active ? ACCENT : "#1f1f23"}" fill-opacity="${active ? 0.9 : 1}"/>`);
    }
  }
  const inner = `
    <text x="0" y="0" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">SCHEDULE</text>
    <g transform="translate(0, 16)">
      <text x="0" y="32" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="44" font-weight="800" fill="${ACCENT}">~11<tspan font-size="22">PM</tspan></text>
      <text x="0" y="52" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="11" fill="${SUBTLE}">Eastern Daylight Time</text>
    </g>
    <g transform="translate(0, 90)">
      ${["S", "M", "T", "W", "T", "F", "S"].map((d, i) => `
        <text x="${45 + i * 46}" y="0" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" font-weight="700" fill="${[0,1,3].includes(i) ? "#efeff1" : SUBTLE}" text-anchor="middle">${d}</text>
      `).join("")}
    </g>
    <g transform="translate(0, 10)">
      ${visibleHours.map((label, i) => `<text x="0" y="${118 + i * 22}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="9" fill="${SUBTLE}">${label}</text>`).join("")}
      <g transform="translate(0, 108)">${cells.join("")}</g>
    </g>
  `;
  return panelFrame(280, inner);
}

// v0.8 — minimal subtract: just hero + day letters + footer
function panelV08() {
  const inner = `
    <text x="0" y="0" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="12" fill="${MUTED}">Sun · Tue · Mon <tspan fill="#00c8af">●</tspan></text>
    <text x="0" y="60" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="48" font-weight="800" fill="${ACCENT}" letter-spacing="-0.04em">~11<tspan font-size="22">PM</tspan></text>
    <text x="0" y="80" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="11" fill="${SUBTLE}">Eastern Daylight Time</text>
    <g transform="translate(0, 110)">
      ${["S", "M", "T", "W", "T", "F", "S"].map((d, i) => `
        <text x="${i * 50}" y="0" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="${[0,1,3].includes(i) ? ACCENT : "#3a3a3d"}" text-anchor="middle">${d}</text>
      `).join("")}
    </g>
    <text x="0" y="160" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">NEXT COLLAB <tspan font-weight="600" fill="#efeff1">Sat 6 PM</tspan></text>
    <text x="170" y="220" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" fill="${SUBTLE}" text-anchor="middle">Powered by Collab Planner</text>
  `;
  return panelFrame(240, inner);
}

// v0.9 — rich + restraint: hero, calendar, recent games, last live, collabs
function panelV09() {
  const calCells = [];
  const labels = ["10p", "11p", "12a", "1a", "2a", "3a"];
  for (let h = 0; h < labels.length; h++) {
    for (let d = 0; d < 7; d++) {
      const active = (d === 0 || d === 1 || d === 3) && h >= 1 && h <= 4;
      const radius = h === 1 ? "5 5 0 0" : h === 4 ? "0 0 5 5" : "0";
      calCells.push(`<rect x="${22 + d * 44}" y="${h * 18}" width="40" height="16" rx="${h === 1 || h === 4 ? 4 : 1}" fill="${active ? ACCENT : "#1f1f23"}" fill-opacity="${active ? 0.95 : 1}"/>`);
    }
  }
  const inner = `
    <text x="0" y="0" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="9" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">NEXT LIKELY LIVE <tspan fill="#00c8af">●</tspan></text>
    <text x="0" y="22" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="14" font-weight="600" fill="#efeff1">Monday <tspan fill="${MUTED}" font-weight="400" font-size="11">· tonight</tspan></text>
    <text x="0" y="60" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="42" font-weight="800" fill="${ACCENT}" letter-spacing="-0.04em"><tspan font-size="18" fill-opacity="0.5">~</tspan>11<tspan font-size="18" fill-opacity="0.85">PM</tspan></text>
    <text x="0" y="78" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" fill="${SUBTLE}">Eastern Daylight Time</text>

    <g transform="translate(0, 100)">
      ${["S", "M", "T", "W", "T", "F", "S"].map((d, i) => `
        <text x="${43 + i * 44}" y="0" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" font-weight="700" fill="${[0,1,3].includes(i) ? ACCENT : "#3a3a3d"}" text-anchor="middle">${d}</text>
      `).join("")}
      ${labels.map((label, i) => `<text x="0" y="${24 + i * 18 + 11}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="8" fill="${SUBTLE}">${label}</text>`).join("")}
      <g transform="translate(0, 14)">${calCells.join("")}</g>
    </g>

    <g transform="translate(0, 240)">
      <text x="0" y="0" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="9" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">RECENTLY PLAYED</text>
      ${[0, 1, 2, 3].map((i) => `
        <rect x="${i * 70}" y="10" width="60" height="80" rx="4" fill="#2a2a2e" stroke="#3a3a3d" stroke-width="0.5"/>
      `).join("")}
    </g>

    <text x="0" y="370" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="10" fill="${SUBTLE}">Last live: 2d ago · 5h duration</text>

    <g transform="translate(0, 390)">
      <text x="0" y="0" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="9" font-weight="700" fill="${SUBTLE}" letter-spacing="0.08em">UPCOMING COLLABS</text>
      <text x="0" y="18" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="11" fill="#efeff1">Sat 6PM <tspan fill="${MUTED}">with </tspan>@alice, @bob</text>
      <text x="0" y="34" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="11" fill="#efeff1">Tue 8PM <tspan fill="${MUTED}">with </tspan>@carl · Marvel Rivals</text>
    </g>
  `;
  return panelFrame(490, inner);
}

// ── Build the slideshow ───────────────────────────────────────────
const slides = [
  {
    version: "v0.2",
    title: "The kitchen sink.",
    lesson: "Heatmap. Day chips. Game tag. Collab list.\nEvery stat I could compute, all at once.\nFelt like a dashboard, not a product.",
    panel: panelV02(),
  },
  {
    version: "v0.5",
    title: "Hours on the side.",
    lesson: "User: \"hours should be on side not on top.\"\nRotated the grid 90°. Made it WORSE —\n24 thin rows in 300px = cramped soup.",
    panel: panelV05(),
  },
  {
    version: "v0.7",
    title: "iOS Calendar — literal edition.",
    lesson: "User: \"my mind goes to an Apple iOS\ncalendar but weekly.\" Built a real grid widget.\nUser: \"still ugly and small.\"",
    panel: panelV07(),
  },
  {
    version: "v0.8",
    title: "Subtract everything.",
    lesson: "Dispatched a fresh-eyes agent to audit.\nIt told me: \"every round you've been asked\nto SUBTRACT.\" Cut the heatmap. The last live.\nThe game chip. Down to just the hero.\nUser: \"I said BEAUTIFUL, not minimal.\"",
    panel: panelV08(),
  },
  {
    version: "v0.9",
    title: "Rich + restraint.",
    lesson: "The synthesis. Apple apps aren't minimal —\nthey're rich, elegantly arranged.\nBrought back the calendar, the recent games,\nthe collabs. Reframed hero as \"next live\".\nDesigned restraint, not stripped restraint.",
    panel: panelV09(),
  },
];

const TOTAL = slides.length;
slides.forEach((s, i) => {
  const svg = slide({
    index: i + 1,
    total: TOTAL,
    version: s.version,
    title: s.title,
    lesson: s.lesson,
    panelSvg: s.panel,
  });
  render(svg, path.join(outDir, `${String(i + 1).padStart(2, "0")}-${s.version.replace(".", "_")}.png`));
});

// Cover slide
const cover = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d0518"/>
      <stop offset="100%" stop-color="#1a0a2e"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <g transform="translate(120, 350)">
    <text font-family="Segoe UI, Inter, Arial, sans-serif" font-size="22" font-weight="600" fill="#9147ff" letter-spacing="0.16em">A DESIGN ITERATION STORY</text>
    <text y="100" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="96" font-weight="800" fill="#efeff1" letter-spacing="-3">${TOTAL} versions of a</text>
    <text y="200" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="96" font-weight="800" fill="#efeff1" letter-spacing="-3">Twitch panel.</text>
    <text y="290" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="24" font-weight="400" fill="#adadb8">Building "Schedule Forecast" for collab.deutschmark.online</text>
  </g>
</svg>`;
render(cover, path.join(outDir, "00-cover.png"));

// Closing slide — the lesson
const closing = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d0518"/>
      <stop offset="100%" stop-color="#1a0a2e"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <g transform="translate(120, 280)">
    <text font-family="Segoe UI, Inter, Arial, sans-serif" font-size="22" font-weight="600" fill="#9147ff" letter-spacing="0.16em">THE LESSON</text>
    <text y="100" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="72" font-weight="800" fill="#efeff1" letter-spacing="-2">"iOS Calendar" didn't mean</text>
    <text y="185" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="72" font-weight="800" fill="#efeff1" letter-spacing="-2">"build a calendar widget."</text>
    <text y="290" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="72" font-weight="800" fill="#9147ff" letter-spacing="-2">It meant restraint with richness.</text>
    <text y="400" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="26" font-weight="400" fill="#adadb8">Apple apps are dense with information,</text>
    <text y="438" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="26" font-weight="400" fill="#adadb8">but every element earned its place.</text>
  </g>
</svg>`;
render(closing, path.join(outDir, `${String(TOTAL + 1).padStart(2, "0")}-lesson.png`));

console.log(`\nDone — ${TOTAL + 2} slides at ${outDir}`);
