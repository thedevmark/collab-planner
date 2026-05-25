//
// Broadcaster-set configuration for the Twitch extension. Persisted in
// Twitch's Extension Configuration Service (broadcaster segment). Read by
// both the SPA (client) and the panel API (server).
//
// IMPORTANT: This file is intentionally duplicated at
//   twitch-extension/src/lib/configSchema.ts
// because the SPA is a separate npm workspace and cannot import from this
// package. The body below "SCHEMA_BODY_START" through "SCHEMA_BODY_END"
// must remain byte-identical between the two files. A test enforces it.

// SCHEMA_BODY_START

export type ExtConfigV1 = {
  v: 1;
  tz: string;
  showCollabs: boolean;
  showGame: boolean;
  accentColor: string;
  cta: { label: string; url: string } | null;
};

export const DEFAULT_CONFIG: ExtConfigV1 = {
  v: 1,
  tz: "UTC",
  showCollabs: true,
  showGame: true,
  accentColor: "#9146FF",
  cta: null,
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function coerceBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true" || value === "yes" || value === "1") return true;
    if (value === "false" || value === "no" || value === "0") return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function parseCta(raw: unknown): ExtConfigV1["cta"] {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const url = typeof r.url === "string" ? r.url : "";
  const labelRaw = typeof r.label === "string" ? r.label : "";
  const label = labelRaw.trim().slice(0, 40);
  if (!label) return null;
  if (!url.startsWith("https://")) return null;
  return { label, url };
}

export function parseConfig(content: string | null | undefined): ExtConfigV1 {
  if (!content) return DEFAULT_CONFIG;
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return DEFAULT_CONFIG;
  }
  if (!raw || typeof raw !== "object") return DEFAULT_CONFIG;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return DEFAULT_CONFIG;

  const tz = isValidTimeZone(r.tz) ? r.tz : DEFAULT_CONFIG.tz;
  const accentColor =
    typeof r.accentColor === "string" && HEX_RE.test(r.accentColor)
      ? r.accentColor
      : DEFAULT_CONFIG.accentColor;

  return {
    v: 1,
    tz,
    showCollabs: coerceBool(r.showCollabs, DEFAULT_CONFIG.showCollabs),
    showGame: coerceBool(r.showGame, DEFAULT_CONFIG.showGame),
    accentColor,
    cta: parseCta(r.cta),
  };
}

export function serializeConfig(cfg: ExtConfigV1): string {
  return JSON.stringify(cfg);
}

// SCHEMA_BODY_END
