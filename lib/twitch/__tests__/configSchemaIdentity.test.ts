import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MARK_START = "// SCHEMA_BODY_START";
const MARK_END = "// SCHEMA_BODY_END";

function extractBody(absPath: string): string {
  const content = readFileSync(absPath, "utf8");
  const start = content.indexOf(MARK_START);
  const end = content.indexOf(MARK_END);
  if (start === -1 || end === -1) {
    throw new Error(`Missing markers in ${absPath}`);
  }
  return content.slice(start + MARK_START.length, end).trim();
}

describe("config schema duplication", () => {
  it("backend and SPA copies have byte-identical body", () => {
    const backend = extractBody(resolve(__dirname, "../extensionConfigSchema.ts"));
    const spa = extractBody(resolve(__dirname, "../../../twitch-extension/src/lib/configSchema.ts"));
    expect(spa).toEqual(backend);
  });
});
