// Generates Twitch Extension dashboard assets from existing brand SVGs:
//   - logo.png       100x100  (required)
//   - discovery.png  300x200  (required, discovery tab tile)
//   - screenshot.png 1024x768 (required, detail-page screenshot)
//
// Run: `node twitch-extension/scripts/generate-assets.mjs`
// Outputs land in twitch-extension/assets/.

import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const outDir = path.resolve(here, "..", "assets");
mkdirSync(outDir, { recursive: true });

// Inter font buffers — passed to resvg's font loader directly.
// resvg-js 2.6 doesn't honor data-URI @font-face inside the SVG, so we pass
// the buffers via the API and reference them by their internal family name.
const interDir = path.join(repoRoot, "node_modules", "@fontsource/inter/files");
const interFontBuffers = [400, 500, 600, 700].map((w) =>
  readFileSync(path.join(interDir, `inter-latin-${w}-normal.woff2`))
);
// Placeholder kept for legacy refs; left empty since fonts come from buffers.
const interStyle = "";

function renderSvgToPng(svg, outputPath) {
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: interFontBuffers,
      defaultFontFamily: "Segoe UI",
      // System fonts give resvg a proper fallback if a glyph isn't in Inter
      // (e.g. the ↗ arrow). Without this it falls through to a condensed
      // built-in font that doesn't read as the brand.
      loadSystemFonts: true,
    },
  });
  writeFileSync(outputPath, resvg.render().asPng());
}

// Dedicated extension icon (calendar + forecast curve), authored at
// twitch-extension/assets/_logo-source.svg.
const extensionIconPath = path.join(outDir, "_logo-source.svg");
const extensionIconSvg = readFileSync(extensionIconPath, "utf8");
const extensionIconBuf = Buffer.from(extensionIconSvg);

// Collab Planner brand mark (interlocking rings) — used in the discovery
// composition for brand attribution.
const ringsSvgPath = path.join(repoRoot, "app", "icon.svg");
const iconSvg = readFileSync(ringsSvgPath, "utf8");

// ── 1. Logo 100x100 ─────────────────────────────────────────────────
// The Schedule Forecast extension has its own icon — rendered straight to PNG.
await sharp(extensionIconBuf, { density: 1200 })
  .resize(100, 100, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(outDir, "logo.png"));
console.log("wrote logo.png (100x100)");

// ── 2. Discovery tile 300x200 ───────────────────────────────────────
// SVG composes: icon on the left, name + tagline on the right.
const discoverySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
  ${interStyle}
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a0e2e"/>
      <stop offset="100%" stop-color="#0d0518"/>
    </linearGradient>
  </defs>
  <rect width="300" height="200" fill="url(#bg)"/>
  <g transform="translate(20, 50)">
    <image href="data:image/svg+xml;base64,${Buffer.from(extensionIconSvg).toString("base64")}" width="100" height="100"/>
  </g>
  <g font-family="Segoe UI, Arial, sans-serif" fill="#efeff1">
    <text x="140" y="92" font-size="22" font-weight="700" letter-spacing="-0.5">Schedule</text>
    <text x="140" y="118" font-size="22" font-weight="700" letter-spacing="-0.5" fill="#9147ff">Forecast</text>
    <text x="140" y="142" font-size="11" font-weight="500" fill="#adadb8">by Collab Planner</text>
  </g>
  <text x="20" y="180" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="500" fill="#6b6b75" letter-spacing="0.3">WHEN THIS STREAMER IS LIKELY LIVE</text>
</svg>`;
renderSvgToPng(discoverySvg, path.join(outDir, "discovery.png"));
console.log("wrote discovery.png (300x200)");

// ── 3. Detail-page screenshot 1024x768 ──────────────────────────────
// Mocks a Twitch channel sidebar with the panel populated, plus a
// caption strip on the left half explaining what the viewer sees.
const screenshotSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  ${interStyle}
  <defs>
    <linearGradient id="page" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a0e2e"/>
      <stop offset="100%" stop-color="#0d0518"/>
    </linearGradient>
    <filter id="panel-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- Page background -->
  <rect width="1024" height="768" fill="url(#page)"/>

  <!-- Left side: caption -->
  <g font-family="Segoe UI, Arial, sans-serif" fill="#efeff1">
    <text x="60" y="140" font-size="48" font-weight="700" letter-spacing="-1.5">Schedule Forecast</text>
    <text x="60" y="190" font-size="22" font-weight="500" fill="#adadb8">When this streamer is likely live —</text>
    <text x="60" y="218" font-size="22" font-weight="500" fill="#adadb8">auto-built from broadcast history.</text>

    <g font-size="15" fill="#efeff1">
      <g transform="translate(60, 290)">
        <circle cx="6" cy="6" r="6" fill="#9147ff"/>
        <text x="22" y="11">Five most likely upcoming streams, ranked.</text>
      </g>
      <g transform="translate(60, 326)">
        <circle cx="6" cy="6" r="6" fill="#9147ff"/>
        <text x="22" y="11">Posted Twitch schedule replaces guesses where it exists.</text>
      </g>
      <g transform="translate(60, 362)">
        <circle cx="6" cy="6" r="6" fill="#9147ff"/>
        <text x="22" y="11">Upcoming collabs surfaced when planned.</text>
      </g>
      <g transform="translate(60, 398)">
        <circle cx="6" cy="6" r="6" fill="#9147ff"/>
        <text x="22" y="11">Works on every channel — no streamer setup required.</text>
      </g>
    </g>

    <text x="60" y="700" font-size="13" fill="#6b6b75">collab.deutschmark.online</text>
  </g>

  <!-- Right side: panel mockup (~318px wide, on a fake sidebar background) -->
  <g transform="translate(620, 130)" filter="url(#panel-shadow)">
    <rect width="340" height="480" rx="6" fill="#18181b"/>

    <!-- Panel header -->
    <text x="20" y="38" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="600" fill="#efeff1">Likely upcoming streams</text>
    <line x1="20" y1="52" x2="320" y2="52" stroke="#2a2a2e" stroke-width="1"/>

    <!-- Prediction rows -->
    <g font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#efeff1">
      <g transform="translate(20, 78)">
        <text fill="#adadb8" font-weight="600">Tue</text>
        <text x="50">7:00 PM</text>
        <text x="180" fill="#adadb8" font-size="11">~3h</text>
        <text x="240" fill="#9147ff">★★★</text>
      </g>
      <line x1="20" y1="92" x2="320" y2="92" stroke="#2a2a2e"/>

      <g transform="translate(20, 112)">
        <text fill="#adadb8" font-weight="600">Wed</text>
        <text x="50">7:30 PM</text>
        <text x="180" fill="#adadb8" font-size="11">~3h</text>
        <rect x="232" y="-10" width="78" height="16" rx="3" fill="#00c8af"/>
        <text x="240" y="1" fill="#0e0e10" font-size="9" font-weight="700">SCHEDULED</text>
      </g>
      <line x1="20" y1="126" x2="320" y2="126" stroke="#2a2a2e"/>

      <g transform="translate(20, 146)">
        <text fill="#adadb8" font-weight="600">Thu</text>
        <text x="50">8:00 PM</text>
        <text x="180" fill="#adadb8" font-size="11">~4h</text>
        <text x="240" fill="#9147ff">★★★</text>
      </g>
      <line x1="20" y1="160" x2="320" y2="160" stroke="#2a2a2e"/>

      <g transform="translate(20, 180)">
        <text fill="#adadb8" font-weight="600">Sat</text>
        <text x="50">6:00 PM</text>
        <text x="180" fill="#adadb8" font-size="11">~5h</text>
        <text x="240" fill="#9147ff">★★★</text>
      </g>
      <line x1="20" y1="194" x2="320" y2="194" stroke="#2a2a2e"/>

      <g transform="translate(20, 214)">
        <text fill="#adadb8" font-weight="600">Sun</text>
        <text x="50">6:00 PM</text>
        <text x="180" fill="#adadb8" font-size="11">~4h</text>
        <text x="240" fill="#9147ff">★★<tspan fill="#3a3a3d">★</tspan></text>
      </g>
    </g>

    <!-- Collabs section -->
    <text x="20" y="280" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="600" fill="#adadb8" letter-spacing="0.4">UPCOMING COLLABS</text>
    <line x1="20" y1="290" x2="320" y2="290" stroke="#2a2a2e"/>

    <g transform="translate(20, 312)" font-family="Segoe UI, Arial, sans-serif" fill="#efeff1">
      <text font-size="13"><tspan fill="#adadb8" font-weight="600">Sat</tspan>  <tspan>6:00 PM</tspan></text>
      <text x="0" y="18" font-size="12" fill="#adadb8">with @alice @bob</text>
      <text x="0" y="36" font-size="12">Apex Legends</text>
    </g>

    <!-- Footer -->
    <line x1="20" y1="430" x2="320" y2="430" stroke="#2a2a2e"/>
    <text x="170" y="455" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#9147ff">Powered by Collab Planner ↗</text>
  </g>
</svg>`;

renderSvgToPng(screenshotSvg, path.join(outDir, "screenshot.png"));
console.log("wrote screenshot.png (1024x768)");

// Also dump the source SVGs for editing later
writeFileSync(path.join(outDir, "_source-discovery.svg"), discoverySvg);
writeFileSync(path.join(outDir, "_source-screenshot.svg"), screenshotSvg);
console.log("wrote _source-*.svg (editable masters)");

console.log("\nAll three assets in twitch-extension/assets/");
