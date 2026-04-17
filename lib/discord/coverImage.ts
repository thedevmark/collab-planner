import fs from "fs";
import path from "path";

/**
 * Default cover image for Discord scheduled events. Discord accepts a base64
 * data URI on POST/PATCH `/guilds/{id}/scheduled-events`; it's shown as the
 * banner when the event appears in the server's Events tab.
 *
 * We read the app's own logo off disk once per process and cache the encoded
 * string — it's ~94 KB PNG, so re-encoding on every create is wasteful. Uses
 * a lazy singleton so a missing file at boot doesn't crash the server; we
 * just skip the image on create in that case.
 */
let cachedDataUri: string | null | undefined;

export function getDefaultDiscordCoverImage(): string | null {
  if (cachedDataUri !== undefined) return cachedDataUri;
  try {
    const file = path.join(process.cwd(), "public", "chained_twitch_logo.png");
    const buf = fs.readFileSync(file);
    cachedDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    cachedDataUri = null;
  }
  return cachedDataUri;
}
