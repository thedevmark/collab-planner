// Zip the dist/ folder into collab-planner-ext-<version>.zip.
// Zero deps: uses the OS `zip` (mac/linux) or PowerShell Compress-Archive (Windows).

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
  execSync(`powershell -Command "Compress-Archive -Path '${distDir}/*' -DestinationPath '${outPath}'"`, {
    stdio: "inherit",
  });
} else {
  execSync(`cd "${distDir}" && zip -r "${outPath}" .`, { stdio: "inherit", shell: "/bin/bash" });
}

console.log(`\nWrote ${outName}`);
