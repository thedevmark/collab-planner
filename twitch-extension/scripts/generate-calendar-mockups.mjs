// Three Rainmeter-inspired calendar designs for the Schedule Forecast panel.
// Renders a 1600x900 comparison sheet with all 3 side-by-side at panel-size.
// Scenario: streams Sun 3PM, Mon 7PM, Wed 7PM. NOW = Mon 5PM.

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
const ACCENT_BRIGHT = "#3a6db0";
const TEAL = "#2ec4b6";
const NOW_RED = "#ff5266";
const MUTED = "#adadb8";
const SUBTLE = "#6b6b75";
const DIM = "#3a3a3d";
const FG = "#efeff1";
const PANEL_FILL = "#18181b";
const PANEL_STROKE = "#2a2a2e";
const GRID_LINE = "#23232a";
const PANEL_W = 380;
const PANEL_H = 500;
const FONT = "Segoe UI, Inter, Arial, sans-serif";
const MONO = "Consolas, 'JetBrains Mono', 'Cascadia Mono', monospace";

const SLIDE_DEFS = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#0d0518"/>
    <stop offset="100%" stop-color="#0a1822"/>
  </linearGradient>
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
`;

// Day-of-week indices: 0=Sun, 1=Mon, ..., 6=Sat
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const SCHEDULE = [
  { dow: 0, hour: 15, duration: 4 }, // Sun 3pm-7pm
  { dow: 1, hour: 19, duration: 4 }, // Mon 7pm-11pm
  { dow: 3, hour: 19, duration: 4 }, // Wed 7pm-11pm
];
const ACTIVE_DOWS = SCHEDULE.map((s) => s.dow);
const NOW_DOW = 1; // Monday
const NOW_HOUR = 17; // 5pm
const NOW_MIN = 22; // visual flair, "5:22 PM"

function fmtHourShort(h) {
  const hr = ((h % 24) + 24) % 24;
  const h12 = hr % 12 || 12;
  return `${h12}${hr >= 12 ? "p" : "a"}`;
}
function fmtHourTall(h) {
  const hr = ((h % 24) + 24) % 24;
  const h12 = hr % 12 || 12;
  return `${h12}${hr >= 12 ? "PM" : "AM"}`;
}

// ── Panel header common to all 3 (small header strip) ───────────────
function panelHeader() {
  return `
    <text x="20" y="34" font-family="${FONT}" font-size="10" font-weight="700" fill="${SUBTLE}" letter-spacing="0.12em">NEXT LIKELY LIVE <tspan fill="${TEAL}">●</tspan></text>
    <text x="20" y="74" font-family="${FONT}" font-size="34" font-weight="800" fill="${ACCENT_BRIGHT}" letter-spacing="-0.04em">in 2h 38m</text>
    <text x="20" y="98" font-family="${FONT}" font-size="12" fill="${MUTED}"><tspan font-weight="600" fill="${FG}">Tonight</tspan> · Mon 7 PM <tspan fill="${SUBTLE}">EDT</tspan></text>
  `;
}

// ── Design A: Hour-rows with NOW line ───────────────────────────────
// Window: 1pm → 11pm (11 rows), so Sun 3pm and M/W 7pm both have visible
// padding above and below their start. NOW = 5pm cuts horizontally.
function designA() {
  const startHour = 13; // 1pm
  const endHour = 23; // 11pm (inclusive)
  const rows = endHour - startHour + 1;

  const gridX = 50;
  const gridY = 130;
  const colW = 42;
  const rowH = 22;
  const gridW = colW * 7;
  const gridH = rowH * rows;

  const cells = [];
  // background grid
  for (let r = 0; r < rows; r++) for (let d = 0; d < 7; d++) {
    cells.push(`<rect x="${gridX + d * colW}" y="${gridY + r * rowH}" width="${colW - 2}" height="${rowH - 2}" rx="3" fill="#1c1c20" stroke="${GRID_LINE}" stroke-width="0.5"/>`);
  }
  // hour labels
  const hourLabels = [];
  for (let r = 0; r < rows; r++) {
    const h = startHour + r;
    hourLabels.push(`<text x="${gridX - 6}" y="${gridY + r * rowH + rowH / 2 + 3}" font-family="${MONO}" font-size="9" fill="${SUBTLE}" text-anchor="end">${fmtHourShort(h)}</text>`);
  }
  // day headers
  const dayHeaders = DAY_LETTERS.map((d, i) => {
    const isActive = ACTIVE_DOWS.includes(i);
    const isToday = i === NOW_DOW;
    return `<rect x="${gridX + i * colW}" y="${gridY - 24}" width="${colW - 2}" height="18" rx="3" fill="${isToday ? ACCENT : "transparent"}"/>
      <text x="${gridX + i * colW + (colW - 2) / 2}" y="${gridY - 10}" font-family="${FONT}" font-size="11" font-weight="700" fill="${isToday ? "#fff" : isActive ? FG : DIM}" text-anchor="middle">${d}</text>`;
  });
  // stream blocks
  const blocks = SCHEDULE.map((s) => {
    const top = gridY + (s.hour - startHour) * rowH;
    const h = s.duration * rowH;
    return `<rect x="${gridX + s.dow * colW + 1}" y="${top + 1}" width="${colW - 4}" height="${h - 4}" rx="4" fill="${ACCENT_BRIGHT}" fill-opacity="0.85"/>
      <text x="${gridX + s.dow * colW + (colW - 2) / 2}" y="${top + 14}" font-family="${MONO}" font-size="8" fill="#fff" font-weight="700" text-anchor="middle">${fmtHourShort(s.hour)}</text>`;
  });
  // NOW line
  const nowY = gridY + (NOW_HOUR - startHour) * rowH + (NOW_MIN / 60) * rowH;
  const nowLine = `
    <line x1="${gridX - 4}" y1="${nowY}" x2="${gridX + gridW}" y2="${nowY}" stroke="${NOW_RED}" stroke-width="1.5"/>
    <circle cx="${gridX - 4}" cy="${nowY}" r="3" fill="${NOW_RED}"/>
    <rect x="${gridX + gridW + 4}" y="${nowY - 9}" width="44" height="18" rx="3" fill="${NOW_RED}"/>
    <text x="${gridX + gridW + 26}" y="${nowY + 4}" font-family="${MONO}" font-size="10" fill="#fff" font-weight="700" text-anchor="middle">NOW</text>
  `;

  return `
    <rect width="${PANEL_W}" height="${PANEL_H}" rx="14" fill="${PANEL_FILL}" stroke="${PANEL_STROKE}"/>
    ${panelHeader()}
    <text x="20" y="120" font-family="${FONT}" font-size="9" font-weight="700" fill="${SUBTLE}" letter-spacing="0.12em">WEEKLY GRID</text>
    ${dayHeaders.join("")}
    ${cells.join("")}
    ${hourLabels.join("")}
    ${blocks.join("")}
    ${nowLine}
    <text x="20" y="480" font-family="${FONT}" font-size="10" fill="${SUBTLE}">Sun 3PM · Mon &amp; Wed 7PM <tspan fill="${MUTED}">EDT</tspan></text>
  `;
}

// ── Design B: Per-day timeline strips ───────────────────────────────
// 7 horizontal rows (one per day-of-week). Time axis runs 12pm→12am along
// the bottom. Stream pills sit on each active day's row at its real time.
// NOW needle drops vertically across all rows.
function designB() {
  const stripStart = 12; // noon
  const stripEnd = 24; // midnight
  const stripHours = stripEnd - stripStart;

  const x0 = 60;
  const y0 = 130;
  const stripW = 290;
  const rowH = 28;
  const totalH = rowH * 7;

  const hourPerPx = stripW / stripHours;

  // day rows
  const rows = DAY_LETTERS.map((d, i) => {
    const y = y0 + i * rowH;
    const isActive = ACTIVE_DOWS.includes(i);
    const isToday = i === NOW_DOW;
    const labelFill = isToday ? "#fff" : isActive ? FG : DIM;
    const labelBg = isToday ? `<rect x="${x0 - 28}" y="${y + 5}" width="20" height="18" rx="3" fill="${ACCENT}"/>` : "";
    const rowBg = `<rect x="${x0}" y="${y + 4}" width="${stripW}" height="${rowH - 8}" rx="3" fill="#1c1c20"/>`;
    return `${labelBg}
      <text x="${x0 - 18}" y="${y + 18}" font-family="${FONT}" font-size="11" font-weight="700" fill="${labelFill}" text-anchor="middle">${d}</text>
      ${rowBg}`;
  });
  // stream pills
  const pills = SCHEDULE.map((s) => {
    const px = x0 + (s.hour - stripStart) * hourPerPx;
    const pw = s.duration * hourPerPx;
    const py = y0 + s.dow * rowH + 4;
    const ph = rowH - 8;
    return `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="3" fill="${ACCENT_BRIGHT}"/>
      <text x="${px + 6}" y="${py + ph / 2 + 4}" font-family="${MONO}" font-size="9" fill="#fff" font-weight="700">${fmtHourShort(s.hour)}–${fmtHourShort(s.hour + s.duration)}</text>`;
  });
  // hour ticks along the bottom
  const ticks = [];
  for (let h = stripStart; h <= stripEnd; h += 2) {
    const tx = x0 + (h - stripStart) * hourPerPx;
    const lbl = h === 24 ? "12a" : fmtHourShort(h);
    ticks.push(`<line x1="${tx}" y1="${y0 + totalH + 2}" x2="${tx}" y2="${y0 + totalH + 6}" stroke="${SUBTLE}" stroke-width="0.7"/>
      <text x="${tx}" y="${y0 + totalH + 17}" font-family="${MONO}" font-size="8" fill="${SUBTLE}" text-anchor="middle">${lbl}</text>`);
  }
  // NOW needle
  const nowX = x0 + (NOW_HOUR + NOW_MIN / 60 - stripStart) * hourPerPx;
  const nowLine = `
    <line x1="${nowX}" y1="${y0 - 4}" x2="${nowX}" y2="${y0 + totalH + 4}" stroke="${NOW_RED}" stroke-width="1.5"/>
    <rect x="${nowX - 22}" y="${y0 - 22}" width="44" height="18" rx="3" fill="${NOW_RED}"/>
    <text x="${nowX}" y="${y0 - 10}" font-family="${MONO}" font-size="10" fill="#fff" font-weight="700" text-anchor="middle">NOW</text>
  `;

  return `
    <rect width="${PANEL_W}" height="${PANEL_H}" rx="14" fill="${PANEL_FILL}" stroke="${PANEL_STROKE}"/>
    ${panelHeader()}
    <text x="20" y="120" font-family="${FONT}" font-size="9" font-weight="700" fill="${SUBTLE}" letter-spacing="0.12em">PER-DAY TIMELINE</text>
    ${rows.join("")}
    ${pills.join("")}
    ${ticks.join("")}
    ${nowLine}
    <text x="20" y="480" font-family="${FONT}" font-size="10" fill="${SUBTLE}">Sun 3PM · Mon &amp; Wed 7PM <tspan fill="${MUTED}">EDT</tspan></text>
  `;
}

// ── Design C: Radial 24h dial ───────────────────────────────────────
// Circular Rainmeter-widget face. 24h clock, 12am at top, 12pm at bottom.
// Day-colored wedges at each active start time. NOW hand points to current.
function designC() {
  const cx = PANEL_W / 2;
  const cy = 290;
  const rOuter = 130;
  const rInner = 95;
  const rTick = 138;

  // Helper: angle for hour h (0..24). 0h = top, clockwise.
  function angleForHour(h) {
    return (h / 24) * 2 * Math.PI - Math.PI / 2;
  }
  function pointAt(r, h) {
    const a = angleForHour(h);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  function arcPath(rO, rI, hStart, hEnd) {
    const a1 = angleForHour(hStart);
    const a2 = angleForHour(hEnd);
    const large = (hEnd - hStart) > 12 ? 1 : 0;
    const p1 = [cx + rO * Math.cos(a1), cy + rO * Math.sin(a1)];
    const p2 = [cx + rO * Math.cos(a2), cy + rO * Math.sin(a2)];
    const p3 = [cx + rI * Math.cos(a2), cy + rI * Math.sin(a2)];
    const p4 = [cx + rI * Math.cos(a1), cy + rI * Math.sin(a1)];
    return `M ${p1[0]} ${p1[1]} A ${rO} ${rO} 0 ${large} 1 ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]} A ${rI} ${rI} 0 ${large} 0 ${p4[0]} ${p4[1]} Z`;
  }

  // Hour ticks every 3h, labels at 12am/6am/12pm/6pm
  const ticks = [];
  for (let h = 0; h < 24; h++) {
    const isMajor = h % 6 === 0;
    const isMinor = h % 3 === 0;
    if (!isMajor && !isMinor) continue;
    const [x1, y1] = pointAt(rOuter + 2, h);
    const [x2, y2] = pointAt(isMajor ? rOuter + 12 : rOuter + 7, h);
    ticks.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${isMajor ? MUTED : SUBTLE}" stroke-width="${isMajor ? 1.5 : 1}"/>`);
    if (isMajor) {
      const [lx, ly] = pointAt(rTick + 12, h);
      ticks.push(`<text x="${lx}" y="${ly + 4}" font-family="${MONO}" font-size="10" fill="${MUTED}" font-weight="700" text-anchor="middle">${fmtHourShort(h)}</text>`);
    }
  }

  // Outer + inner rings (decorative)
  const rings = `
    <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="${GRID_LINE}" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="none" stroke="${GRID_LINE}" stroke-width="1"/>
  `;

  // Stream wedges — grouped by start hour so M+W share their 7pm wedge but
  // get separate day labels on it.
  const SUN_COL = TEAL;
  const MW_COL = ACCENT_BRIGHT;
  const wedges = `
    <path d="${arcPath(rOuter - 2, rInner + 2, 15, 19)}" fill="${SUN_COL}" fill-opacity="0.7"/>
    <path d="${arcPath(rOuter - 2, rInner + 2, 19, 23)}" fill="${MW_COL}" fill-opacity="0.85"/>
  `;
  // Wedge labels (place radial center of each)
  function wedgeLabel(hMid, label, sub) {
    const [tx, ty] = pointAt((rOuter + rInner) / 2, hMid);
    return `<text x="${tx}" y="${ty - 3}" font-family="${MONO}" font-size="11" fill="#fff" font-weight="800" text-anchor="middle">${label}</text>
      <text x="${tx}" y="${ty + 11}" font-family="${FONT}" font-size="9" fill="#fff" fill-opacity="0.8" text-anchor="middle">${sub}</text>`;
  }
  const wedgeLabels = `
    ${wedgeLabel(17, "3 PM", "Sun")}
    ${wedgeLabel(21, "7 PM", "M · W")}
  `;

  // NOW hand
  const [nx, ny] = pointAt(rOuter - 6, NOW_HOUR + NOW_MIN / 60);
  const nowHand = `
    <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${NOW_RED}" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="4" fill="${NOW_RED}"/>
  `;

  // Center readout
  const center = `
    <text x="${cx}" y="${cy - 6}" font-family="${MONO}" font-size="9" fill="${SUBTLE}" letter-spacing="0.1em" text-anchor="middle">NOW</text>
    <text x="${cx}" y="${cy + 16}" font-family="${MONO}" font-size="20" font-weight="800" fill="${FG}" text-anchor="middle">5:22 PM</text>
    <text x="${cx}" y="${cy + 32}" font-family="${FONT}" font-size="10" fill="${SUBTLE}" text-anchor="middle">in 2h 38m</text>
  `;

  return `
    <rect width="${PANEL_W}" height="${PANEL_H}" rx="14" fill="${PANEL_FILL}" stroke="${PANEL_STROKE}"/>
    ${panelHeader()}
    <text x="20" y="120" font-family="${FONT}" font-size="9" font-weight="700" fill="${SUBTLE}" letter-spacing="0.12em">24-HOUR DIAL</text>
    ${rings}
    ${ticks.join("")}
    ${wedges}
    ${wedgeLabels}
    ${nowHand}
    ${center}
    <text x="20" y="480" font-family="${FONT}" font-size="10" fill="${SUBTLE}">Sun 3PM · Mon &amp; Wed 7PM <tspan fill="${MUTED}">EDT</tspan></text>
  `;
}

// ── Compose 1600x900 comparison sheet ───────────────────────────────
const cols = [
  { title: "A. Hour-rows + NOW line", caption: "Calendar grid · per-day blocks · horizontal NOW rule", body: designA() },
  { title: "B. Per-day timelines",    caption: "7 rows · stream pills at real times · vertical NOW needle", body: designB() },
  { title: "C. 24-hour dial",         caption: "Radial widget · wedge per start time · NOW hand", body: designC() },
];

const gutter = (1600 - PANEL_W * 3) / 4;
const panelY = 200;
const panels = cols.map((c, i) => {
  const x = gutter + i * (PANEL_W + gutter);
  return `
    <text x="${x + PANEL_W / 2}" y="${panelY - 50}" font-family="${FONT}" font-size="22" font-weight="700" fill="${FG}" text-anchor="middle">${c.title}</text>
    <text x="${x + PANEL_W / 2}" y="${panelY - 24}" font-family="${FONT}" font-size="13" fill="${MUTED}" text-anchor="middle">${c.caption}</text>
    <g transform="translate(${x}, ${panelY})">${c.body}</g>
  `;
});

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>${SLIDE_DEFS}</defs>
  ${SLIDE_BG}

  <text x="800" y="80" font-family="${FONT}" font-size="36" font-weight="800" fill="${FG}" letter-spacing="-0.8" text-anchor="middle">calendar redesign — three directions</text>
  <text x="800" y="120" font-family="${FONT}" font-size="15" fill="${MUTED}" text-anchor="middle">Scenario: Sun 3PM · Mon &amp; Wed 7PM · NOW = Mon 5:22 PM</text>

  ${panels.join("")}
</svg>`;

const outPath = path.join(outDir, "calendar-mockups.png");
const png = new Resvg(svg, {
  font: { fontBuffers: interFonts, defaultFontFamily: "Segoe UI", loadSystemFonts: true },
}).render().asPng();
writeFileSync(outPath, png);
console.log("wrote", outPath);
