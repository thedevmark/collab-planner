// Zip the dist/ folder into collab-planner-ext-<version>.zip.
// Zero deps: uses the OS `zip` (mac/linux) or 7-Zip (Windows).
//
// Why not PowerShell Compress-Archive on Windows: it writes Windows-style
// backslashes into ZIP entry names, violating the ZIP spec. Twitch's CDN
// serves the entries verbatim, so panel.html's `./assets/foo.js` 404s and
// the panel iframe stays empty with no console error.

import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const distDir = path.join(root, "dist");

if (!existsSync(distDir)) {
  console.error("dist/ does not exist. Run `npm run build` first.");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const outName = `collab-planner-ext-${pkg.version}.zip`;
const outPath = path.join(root, outName);

if (existsSync(outPath)) rmSync(outPath);

const isWindows = process.platform === "win32";
if (isWindows) {
  const sevenZipCandidates = [
    "C:\\Program Files\\7-Zip\\7z.exe",
    "C:\\Program Files (x86)\\7-Zip\\7z.exe",
  ];
  const sevenZip = sevenZipCandidates.find((p) => existsSync(p));
  if (!sevenZip) {
    console.error(
      "7-Zip not found. Install it from https://www.7-zip.org/ (or via `winget install 7zip.7zip`).\n" +
        "Do NOT use PowerShell Compress-Archive — it writes backslash separators that break Twitch hosting."
    );
    process.exit(1);
  }
  execSync(`"${sevenZip}" a -tzip "${outPath}" "${distDir}\\*"`, { stdio: "inherit" });
} else {
  execSync(`cd "${distDir}" && zip -r "${outPath}" .`, { stdio: "inherit", shell: "/bin/bash" });
}

console.log(`\nWrote ${outName}`);
