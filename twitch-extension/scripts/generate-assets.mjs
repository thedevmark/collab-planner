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
        <text x="22" y="11">Plain-English summary: "Streams Sun, Tue, Mon ~7PM."</text>
      </g>
      <g transform="translate(60, 326)">
        <circle cx="6" cy="6" r="6" fill="#9147ff"/>
        <text x="22" y="11">7-day chip row — active days in brand color.</text>
      </g>
      <g transform="translate(60, 362)">
        <circle cx="6" cy="6" r="6" fill="#9147ff"/>
        <text x="22" y="11">Most-played game tag.</text>
      </g>
      <g transform="translate(60, 398)">
        <circle cx="6" cy="6" r="6" fill="#9147ff"/>
        <text x="22" y="11">Upcoming collabs surfaced below when planned.</text>
      </g>
      <g transform="translate(60, 434)">
        <circle cx="6" cy="6" r="6" fill="#9147ff"/>
        <text x="22" y="11">Works on every channel — no streamer setup required.</text>
      </g>
    </g>

    <text x="60" y="700" font-size="13" fill="#6b6b75">collab.deutschmark.online</text>
  </g>

  <!-- Right side: panel mockup (~318px wide, on a fake sidebar background) -->
  <g transform="translate(620, 200)" filter="url(#panel-shadow)">
    <rect width="340" height="340" rx="6" fill="#18181b"/>

    <!-- Summary line: "↗ Streams Sun, Tue, Mon ~7PM" + posted-dot -->
    <g transform="translate(20, 34)" font-family="Segoe UI, Arial, sans-serif">
      <text fill="#adadb8" font-size="13">↗  Streams Sun, Tue, Mon ~7PM</text>
      <circle cx="248" cy="-3" r="4" fill="#00c8af"/>
    </g>

    <!-- Day chips -->
    <g transform="translate(20, 56)" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="600">
      <g>
        <rect x="0"   y="0" width="32" height="20" rx="4" fill="#9147ff"/>
        <text x="16"  y="14" text-anchor="middle" fill="#ffffff">Sun</text>
      </g>
      <g>
        <rect x="36"  y="0" width="32" height="20" rx="4" fill="#9147ff"/>
        <text x="52"  y="14" text-anchor="middle" fill="#ffffff">Mon</text>
      </g>
      <g>
        <rect x="72"  y="0" width="32" height="20" rx="4" fill="#9147ff"/>
        <text x="88"  y="14" text-anchor="middle" fill="#ffffff">Tue</text>
      </g>
      <g>
        <rect x="108" y="0" width="32" height="20" rx="4" fill="#2a2a2e"/>
        <text x="124" y="14" text-anchor="middle" fill="#6b6b75">Wed</text>
      </g>
      <g>
        <rect x="144" y="0" width="32" height="20" rx="4" fill="#2a2a2e"/>
        <text x="160" y="14" text-anchor="middle" fill="#6b6b75">Thu</text>
      </g>
      <g>
        <rect x="180" y="0" width="32" height="20" rx="4" fill="#2a2a2e"/>
        <text x="196" y="14" text-anchor="middle" fill="#6b6b75">Fri</text>
      </g>
      <g>
        <rect x="216" y="0" width="32" height="20" rx="4" fill="#2a2a2e"/>
        <text x="232" y="14" text-anchor="middle" fill="#6b6b75">Sat</text>
      </g>
    </g>

    <!-- Game chip -->
    <g transform="translate(20, 90)">
      <rect x="0" y="0" width="98" height="22" rx="4" fill="none" stroke="#3a3a3d"/>
      <text x="49" y="15" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#efeff1">Apex Legends</text>
    </g>

    <!-- Collabs section -->
    <text x="20" y="152" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="600" fill="#adadb8" letter-spacing="0.5">UPCOMING COLLABS</text>

    <g transform="translate(20, 178)" font-family="Segoe UI, Arial, sans-serif">
      <text font-size="13" fill="#efeff1"><tspan fill="#adadb8" font-weight="600">Sat</tspan>  <tspan>6:00 PM</tspan></text>
      <text x="0" y="20" font-size="12" fill="#adadb8">with @alice @bob</text>
      <text x="0" y="40" font-size="12" fill="#efeff1">Apex Legends</text>
    </g>

    <!-- Footer -->
    <line x1="20" y1="284" x2="320" y2="284" stroke="#2a2a2e"/>
    <text x="170" y="306" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#9147ff">Powered by Collab Planner ↗</text>
  </g>
</svg>`;

renderSvgToPng(screenshotSvg, path.join(outDir, "screenshot-1-overview.png"));
console.log("wrote screenshot-1-overview.png (1024x768)");

// ── 4. Screenshot 2 — Anatomy / hybrid schedule closeup ──────────────
// Bigger panel mockup with callouts pointing to the predicted vs scheduled
// distinction and the confidence stars. Hammers the "this is not the
// streamer's typed-in schedule" point.
const screenshot2Svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>
    <linearGradient id="page2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a0e2e"/>
      <stop offset="100%" stop-color="#0d0518"/>
    </linearGradient>
    <filter id="panel-shadow2" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <rect width="1024" height="768" fill="url(#page2)"/>

  <g font-family="Segoe UI, Arial, sans-serif" fill="#efeff1">
    <text x="60" y="100" font-size="40" font-weight="700" letter-spacing="-1.2">Built from broadcast history.</text>
    <text x="60" y="148" font-size="18" font-weight="500" fill="#adadb8">Each element is derived from the streamer's actual VODs — not aspirational.</text>
  </g>

  <!-- Panel scaled up (~2x panel width) -->
  <g transform="translate(80, 220)" filter="url(#panel-shadow2)">
    <rect width="460" height="430" rx="8" fill="#18181b"/>

    <!-- Summary line -->
    <g transform="translate(28, 50)" font-family="Segoe UI, Arial, sans-serif">
      <text fill="#adadb8" font-size="18">↗  Streams Sun, Tue, Mon ~7PM</text>
      <circle cx="346" cy="-5" r="6" fill="#00c8af"/>
    </g>

    <!-- Day chips -->
    <g transform="translate(28, 84)" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="600">
      <g>
        <rect x="0"   y="0" width="50" height="30" rx="5" fill="#9147ff"/>
        <text x="25"  y="20" text-anchor="middle" fill="#ffffff">Sun</text>
      </g>
      <g>
        <rect x="58"  y="0" width="50" height="30" rx="5" fill="#9147ff"/>
        <text x="83"  y="20" text-anchor="middle" fill="#ffffff">Mon</text>
      </g>
      <g>
        <rect x="116" y="0" width="50" height="30" rx="5" fill="#9147ff"/>
        <text x="141" y="20" text-anchor="middle" fill="#ffffff">Tue</text>
      </g>
      <g>
        <rect x="174" y="0" width="50" height="30" rx="5" fill="#2a2a2e"/>
        <text x="199" y="20" text-anchor="middle" fill="#6b6b75">Wed</text>
      </g>
      <g>
        <rect x="232" y="0" width="50" height="30" rx="5" fill="#2a2a2e"/>
        <text x="257" y="20" text-anchor="middle" fill="#6b6b75">Thu</text>
      </g>
      <g>
        <rect x="290" y="0" width="50" height="30" rx="5" fill="#2a2a2e"/>
        <text x="315" y="20" text-anchor="middle" fill="#6b6b75">Fri</text>
      </g>
      <g>
        <rect x="348" y="0" width="50" height="30" rx="5" fill="#2a2a2e"/>
        <text x="373" y="20" text-anchor="middle" fill="#6b6b75">Sat</text>
      </g>
    </g>

    <!-- Game chip -->
    <g transform="translate(28, 132)">
      <rect x="0" y="0" width="140" height="30" rx="5" fill="none" stroke="#3a3a3d" stroke-width="1.5"/>
      <text x="70" y="20" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#efeff1">Apex Legends</text>
    </g>

    <!-- Collabs section -->
    <text x="28" y="216" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="#adadb8" letter-spacing="0.5">UPCOMING COLLABS</text>

    <g transform="translate(28, 250)" font-family="Segoe UI, Arial, sans-serif">
      <text font-size="17" fill="#efeff1"><tspan fill="#adadb8" font-weight="600">Sat</tspan>  <tspan>6:00 PM</tspan></text>
      <text x="0" y="26" font-size="15" fill="#adadb8">with @alice @bob</text>
      <text x="0" y="50" font-size="15" fill="#efeff1">Apex Legends</text>
    </g>

    <line x1="28" y1="382" x2="432" y2="382" stroke="#2a2a2e"/>
    <text x="230" y="408" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#9147ff">Powered by Collab Planner ↗</text>
  </g>

  <!-- Callouts on the right -->
  <g font-family="Segoe UI, Arial, sans-serif" fill="#efeff1">
    <!-- Callout: summary line -->
    <g transform="translate(610, 240)">
      <text x="0" y="11" fill="#adadb8" font-size="18">↗</text>
      <text x="24" y="11" font-size="15" font-weight="600">Plain-English summary</text>
      <text x="24" y="36" font-size="14" fill="#adadb8">Top 3 streaming days +</text>
      <text x="24" y="55" font-size="14" fill="#adadb8">median start time, your local TZ.</text>
    </g>

    <!-- Callout: day chips -->
    <g transform="translate(610, 340)">
      <rect width="14" height="14" rx="3" fill="#9147ff"/>
      <text x="24" y="11" font-size="15" font-weight="600">7-day chip row</text>
      <text x="24" y="36" font-size="14" fill="#adadb8">Active days highlighted —</text>
      <text x="24" y="55" font-size="14" fill="#adadb8">scannable at a glance.</text>
    </g>

    <!-- Callout: posted-schedule dot -->
    <g transform="translate(610, 440)">
      <circle cx="7" cy="7" r="6" fill="#00c8af"/>
      <text x="24" y="11" font-size="15" font-weight="600">Posted schedule indicator</text>
      <text x="24" y="36" font-size="14" fill="#adadb8">Teal dot when the streamer</text>
      <text x="24" y="55" font-size="14" fill="#adadb8">has a Twitch schedule posted.</text>
    </g>

    <!-- Callout: game chip -->
    <g transform="translate(610, 540)">
      <rect x="0" y="-2" width="14" height="14" rx="3" fill="none" stroke="#3a3a3d" stroke-width="1.5"/>
      <text x="24" y="11" font-size="15" font-weight="600">Most-played game</text>
      <text x="24" y="36" font-size="14" fill="#adadb8">From their recent VOD</text>
      <text x="24" y="55" font-size="14" fill="#adadb8">category metadata.</text>
    </g>
  </g>
</svg>`;
renderSvgToPng(screenshot2Svg, path.join(outDir, "screenshot-2-anatomy.png"));
console.log("wrote screenshot-2-anatomy.png (1024x768)");

// ── 5. Screenshot 3 — Broadcaster config view ───────────────────────
// Shows what a streamer sees when they install the extension and open
// the config view in their Twitch dashboard. Two states side-by-side:
// "not in CP yet" and "connected".
const screenshot3Svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>
    <linearGradient id="page3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a0e2e"/>
      <stop offset="100%" stop-color="#0d0518"/>
    </linearGradient>
    <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="14" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <rect width="1024" height="768" fill="url(#page3)"/>

  <g font-family="Segoe UI, Arial, sans-serif" fill="#efeff1">
    <text x="60" y="100" font-size="40" font-weight="700" letter-spacing="-1.2">Zero setup for streamers.</text>
    <text x="60" y="148" font-size="18" font-weight="500" fill="#adadb8">Install it. The schedule appears. Connect Collab Planner for more.</text>
  </g>

  <!-- Card 1: not in CP yet -->
  <g transform="translate(80, 220)" filter="url(#card-shadow)">
    <rect width="420" height="380" rx="10" fill="#18181b"/>
    <text x="32" y="56" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#efeff1">Collab Planner</text>
    <text x="32" y="118" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#adadb8">Your channel isn't connected yet.</text>
    <text x="32" y="142" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#adadb8">Sign in with Twitch at Collab Planner —</text>
    <text x="32" y="166" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#adadb8">your panel will start working automatically.</text>

    <rect x="32" y="220" width="220" height="44" rx="6" fill="#9147ff"/>
    <text x="142" y="248" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="600" fill="#ffffff">Sign in with Twitch ↗</text>

    <text x="32" y="340" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#6b6b75" letter-spacing="0.4">FRESH INSTALL</text>
  </g>

  <!-- Card 2: connected -->
  <g transform="translate(524, 220)" filter="url(#card-shadow)">
    <rect width="420" height="380" rx="10" fill="#18181b"/>
    <text x="32" y="56" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#efeff1">Collab Planner</text>
    <!-- Checkmark as a path so it doesn't trip Segoe UI's missing-glyph fallback -->
    <circle cx="208" cy="48" r="13" fill="#00c8af"/>
    <path d="M 201 48 L 206 53 L 215 43" fill="none" stroke="#0e0e10" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="32" y="118" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#adadb8">Account detected. Streams Sun,</text>
    <text x="32" y="142" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#adadb8">Tue, Mon — 2 upcoming collabs.</text>

    <rect x="32" y="220" width="220" height="44" rx="6" fill="#9147ff"/>
    <text x="142" y="248" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="600" fill="#ffffff">Open dashboard ↗</text>

    <text x="32" y="340" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#6b6b75" letter-spacing="0.4">CONNECTED</text>
  </g>

  <text x="60" y="700" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#6b6b75">Broadcaster config view (Twitch dashboard)</text>
</svg>`;
renderSvgToPng(screenshot3Svg, path.join(outDir, "screenshot-3-config.png"));
console.log("wrote screenshot-3-config.png (1024x768)");

// Also dump the source SVGs for editing later
writeFileSync(path.join(outDir, "_source-discovery.svg"), discoverySvg);
writeFileSync(path.join(outDir, "_source-screenshot.svg"), screenshotSvg);
console.log("wrote _source-*.svg (editable masters)");

console.log("\nAll three assets in twitch-extension/assets/");
