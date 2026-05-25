// twitch-extension/src/lib/configSchema.ts
//
// IMPORTANT: This file is a deliberate duplicate of
//   lib/twitch/extensionConfigSchema.ts
// The body between SCHEMA_BODY_START and SCHEMA_BODY_END markers must
// remain byte-identical to that file. The identity test in
//   lib/twitch/__tests__/configSchemaIdentity.test.ts
// enforces this — update both files together.

// SCHEMA_BODY_START

export type ExtConfigV1 = {
  v: 1;
  tz: string;
  showCollabs: boolean;
  showGame: boolean;
  accentColor: string;
};

export const DEFAULT_CONFIG: ExtConfigV1 = {
  v: 1,
  tz: "UTC",
  showCollabs: true,
  showGame: true,
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
    showCollabs: coerceBool(r.showCollabs, DEFAULT_CONFIG.showCollabs),
    showGame: coerceBool(r.showGame, DEFAULT_CONFIG.showGame),
    accentColor,
  };
}

export function serializeConfig(cfg: ExtConfigV1): string {
  return JSON.stringify(cfg);
}

// SCHEMA_BODY_END
