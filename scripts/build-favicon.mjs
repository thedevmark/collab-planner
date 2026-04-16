// One-off: rasterize app/icon.svg into a multi-size favicon.ico.
// ICO is a thin container around PNGs (or BMPs). We stuff the 16/32/48px
// variants in since those are what browsers actually pick from.
//
// Run with: node scripts/build-favicon.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SVG_PATH = join(ROOT, "app", "icon.svg");
const ICO_PATH = join(ROOT, "app", "favicon.ico");
const SIZES = [16, 32, 48];

const svg = readFileSync(SVG_PATH);

// The Venn is 3:2 — fit it into a square canvas with transparent padding so
// the favicon stays centered and doesn't stretch.
const pngs = await Promise.all(
  SIZES.map((size) =>
    sharp(svg)
      .resize({
        width: size,
        height: size,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer(),
  ),
);

// ICONDIR: reserved(2)=0, type(2)=1, count(2)=N
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(SIZES.length, 4);

// ICONDIRENTRY (16 bytes each) + PNG payload
const entries = [];
const payloads = [];
let offset = 6 + 16 * SIZES.length;

for (let i = 0; i < SIZES.length; i++) {
  const size = SIZES[i];
  const png = pngs[i];
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0); // width
  entry.writeUInt8(size === 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2);                        // palette (none)
  entry.writeUInt8(0, 3);                        // reserved
  entry.writeUInt16LE(1, 4);                     // color planes
  entry.writeUInt16LE(32, 6);                    // bits per pixel
  entry.writeUInt32LE(png.length, 8);            // image size
  entry.writeUInt32LE(offset, 12);               // image offset
  entries.push(entry);
  payloads.push(png);
  offset += png.length;
}

writeFileSync(ICO_PATH, Buffer.concat([header, ...entries, ...payloads]));
console.log(`wrote ${ICO_PATH} (${SIZES.join("/")}px)`);
