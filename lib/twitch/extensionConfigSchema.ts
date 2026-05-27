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
  use24Hour: boolean;
  /** Which day starts the calendar week. US/Twitch convention is Sunday;
   *  ISO 8601 / most of Europe use Monday. */
  weekStartsMonday: boolean;
  accentColor: string;
};

export const DEFAULT_CONFIG: ExtConfigV1 = {
  v: 1,
  tz: "UTC",
  use24Hour: false,
  weekStartsMonday: false,
  accentColor: "#9146FF",
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
    use24Hour: coerceBool(r.use24Hour, DEFAULT_CONFIG.use24Hour),
    weekStartsMonday: coerceBool(r.weekStartsMonday, DEFAULT_CONFIG.weekStartsMonday),
    accentColor,
  };
}

export function serializeConfig(cfg: ExtConfigV1): string {
  return JSON.stringify(cfg);
}

// SCHEMA_BODY_END
