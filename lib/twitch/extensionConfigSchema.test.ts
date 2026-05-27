import { describe, it, expect } from "vitest";
import { parseConfig, DEFAULT_CONFIG, serializeConfig, type ExtConfigV1 } from "./extensionConfigSchema";

describe("parseConfig", () => {
  it("returns defaults for null / undefined / empty string", () => {
    expect(parseConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(parseConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(parseConfig("")).toEqual(DEFAULT_CONFIG);
  });

  it("returns defaults for malformed JSON", () => {
    expect(parseConfig("{not json")).toEqual(DEFAULT_CONFIG);
  });

  it("returns defaults when version is missing or wrong", () => {
    expect(parseConfig(JSON.stringify({ tz: "America/New_York" }))).toEqual(DEFAULT_CONFIG);
    expect(parseConfig(JSON.stringify({ v: 2, tz: "America/New_York" }))).toEqual(DEFAULT_CONFIG);
  });

  it("round-trips a full valid config", () => {
    const cfg: ExtConfigV1 = {
      v: 1,
      tz: "America/New_York",
      use24Hour: true,
      weekStartsMonday: true,
      accentColor: "#FF6600",
    };
    expect(parseConfig(serializeConfig(cfg))).toEqual(cfg);
  });

  it("fills missing optional fields with defaults but keeps valid ones", () => {
    const raw = JSON.stringify({ v: 1, tz: "Europe/Berlin" });
    expect(parseConfig(raw)).toEqual({
      ...DEFAULT_CONFIG,
      tz: "Europe/Berlin",
    });
  });

  it("falls back to default tz when tz is not a recognized IANA zone", () => {
    const raw = JSON.stringify({ v: 1, tz: "Not/A/Real/Zone" });
    expect(parseConfig(raw).tz).toEqual(DEFAULT_CONFIG.tz);
  });

  it("falls back to default accentColor when hex is malformed", () => {
    expect(parseConfig(JSON.stringify({ v: 1, accentColor: "red" })).accentColor).toEqual(DEFAULT_CONFIG.accentColor);
    expect(parseConfig(JSON.stringify({ v: 1, accentColor: "#FFF" })).accentColor).toEqual(DEFAULT_CONFIG.accentColor);
    expect(parseConfig(JSON.stringify({ v: 1, accentColor: "#GGGGGG" })).accentColor).toEqual(DEFAULT_CONFIG.accentColor);
  });

it("coerces use24Hour to booleans", () => {
    const raw = JSON.stringify({ v: 1, use24Hour: "yes" });
    const parsed = parseConfig(raw);
    expect(parsed.use24Hour).toBe(true);
  });
});
