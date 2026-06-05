// twitch-extension/src/components/SettingsForm.tsx
import { useEffect, useMemo, useState } from "react";
import { parseConfig, serializeConfig, type ExtConfigV1 } from "../lib/configSchema";
import { setBroadcasterConfiguration } from "../lib/twitchExt";

const CONFIG_VERSION = "1";
const API_BASE = "https://collab.deutschmark.online";

// Curated short-list of timezones with friendly labels. Order roughly
// reflects "most likely to be used by a streamer." Full IANA list still
// available below for anyone outside these regions.
const COMMON_TIMEZONES: Array<{ tz: string; name: string }> = [
  { tz: "Pacific/Honolulu", name: "Hawaii (HST)" },
  { tz: "America/Anchorage", name: "Alaska (AKT)" },
  { tz: "America/Los_Angeles", name: "Pacific (PT)" },
  { tz: "America/Phoenix", name: "Arizona (MST, no DST)" },
  { tz: "America/Denver", name: "Mountain (MT)" },
  { tz: "America/Chicago", name: "Central (CT)" },
  { tz: "America/New_York", name: "Eastern (ET)" },
  { tz: "America/Halifax", name: "Atlantic (AT)" },
  { tz: "America/Sao_Paulo", name: "Brazil (BRT)" },
  { tz: "UTC", name: "UTC" },
  { tz: "Europe/London", name: "London (GMT/BST)" },
  { tz: "Europe/Paris", name: "Central Europe (CET) — Paris" },
  { tz: "Europe/Berlin", name: "Central Europe (CET) — Berlin" },
  { tz: "Europe/Athens", name: "Eastern Europe (EET)" },
  { tz: "Europe/Moscow", name: "Moscow (MSK)" },
  { tz: "Asia/Dubai", name: "Dubai (GST)" },
  { tz: "Asia/Kolkata", name: "India (IST)" },
  { tz: "Asia/Singapore", name: "Singapore (SGT)" },
  { tz: "Asia/Tokyo", name: "Japan (JST)" },
  { tz: "Asia/Seoul", name: "Korea (KST)" },
  { tz: "Australia/Perth", name: "Perth (AWST)" },
  { tz: "Australia/Sydney", name: "Sydney (AET)" },
  { tz: "Pacific/Auckland", name: "Auckland (NZT)" },
];

/** Return a short UTC offset string for an IANA TZ (e.g. "UTC−5", "UTC+9:30"). */
function utcOffset(tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" });
    const parts = fmt.formatToParts(new Date());
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    // raw is "GMT-5", "GMT+5:30", "GMT" etc. Normalize to "UTC−5".
    return raw.replace("GMT", "UTC").replace("-", "−");
  } catch {
    return "";
  }
}

interface Props {
  initialRaw: string | null;
  channelId: string;
  token: string;
}

export function SettingsForm({ initialRaw, channelId, token }: Props) {
  const initial = useMemo(() => {
    const parsed = parseConfig(initialRaw);
    if (!initialRaw) {
      // First-time visitor: pre-fill TZ from the browser
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return { ...parsed, tz: detected };
    }
    return parsed;
  }, [initialRaw]);

  const [tz, setTz] = useState(initial.tz);
  const [use24Hour, setUse24Hour] = useState(initial.use24Hour);
  const [weekStartsMonday, setWeekStartsMonday] = useState(initial.weekStartsMonday);
  const [accentColor, setAccentColor] = useState(initial.accentColor);
  const [theme, setTheme] = useState(initial.theme);
  const [hexInput, setHexInput] = useState(initial.accentColor);
  const [hexCopied, setHexCopied] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [colorFetchStatus, setColorFetchStatus] = useState<"idle" | "loading" | "none">("idle");

  // Keep the hex text input in sync when accentColor changes from the picker
  // or the "Use my Twitch profile color" button.
  useEffect(() => setHexInput(accentColor), [accentColor]);

  function commitHex(value: string) {
    let v = value.trim().toUpperCase();
    if (v && !v.startsWith("#")) v = "#" + v;
    if (/^#[0-9A-F]{6}$/.test(v)) {
      setAccentColor(v);
    } else {
      // revert text input to the last valid color
      setHexInput(accentColor);
    }
  }

  async function copyHex() {
    try {
      await navigator.clipboard.writeText(accentColor);
      setHexCopied(true);
      setTimeout(() => setHexCopied(false), 1500);
    } catch {
      // clipboard may be blocked in some iframe contexts; silent no-op
    }
  }

  const tzOptions = useMemo(() => {
    type SupportedValuesOf = (key: "timeZone") => string[];
    const supported = (Intl as unknown as { supportedValuesOf?: SupportedValuesOf }).supportedValuesOf;
    return supported ? supported("timeZone") : [];
  }, []);

  async function fetchTwitchColor() {
    setColorFetchStatus("loading");
    // The fetch usually returns near-instantly, so the "Fetching…" state
    // flickers by too fast to read as a deliberate action. Hold the
    // loading state for at least 1s so the click feels acknowledged.
    const minDelay = new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch(
        `${API_BASE}/api/extension/channel/${channelId}/twitch-color`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const body = await res.json();
      await minDelay;
      if (body.color) {
        setAccentColor(body.color);
        setColorFetchStatus("idle");
      } else {
        setColorFetchStatus("none");
      }
    } catch {
      await minDelay;
      setColorFetchStatus("none");
    }
  }

  function buildConfig(): ExtConfigV1 {
    return {
      v: 1,
      tz,
      use24Hour,
      weekStartsMonday,
      accentColor,
      theme,
    };
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      const cfg = buildConfig();
      setBroadcasterConfiguration(CONFIG_VERSION, serializeConfig(cfg));
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="settings-form" onSubmit={save}>
      <label>
        <span>Timezone</span>
        <select
          value={tz}
          onChange={(e) => setTz(e.target.value)}
        >
          <optgroup label="Common">
            {COMMON_TIMEZONES.map(({ tz: z, name }) => (
              <option key={z} value={z}>{name} · {utcOffset(z)}</option>
            ))}
          </optgroup>
          <optgroup label="All zones">
            {/* If the current tz isn't in either list (very rare), still show it so the value persists */}
            {!tzOptions.includes(tz) && !COMMON_TIMEZONES.find((c) => c.tz === tz) && (
              <option value={tz}>{tz} · {utcOffset(tz)}</option>
            )}
            {tzOptions.map((z) => (
              <option key={z} value={z}>{z} · {utcOffset(z)}</option>
            ))}
          </optgroup>
        </select>
        <small>Separate from your Collab Planner timezone.</small>
      </label>

      <label className="checkbox">
        <input type="checkbox" checked={use24Hour} onChange={(e) => setUse24Hour(e.target.checked)} />
        <span>24-hour clock</span>
        <span
          className="info-tip"
          data-tip="Show times as 19:00 instead of 7 PM."
          aria-label="What does this do?"
        >ⓘ</span>
      </label>

      <label className="checkbox">
        <input type="checkbox" checked={weekStartsMonday} onChange={(e) => setWeekStartsMonday(e.target.checked)} />
        <span>Start week on Monday</span>
        <span
          className="info-tip"
          data-tip="Calendar runs Mon–Sun instead of Sun–Sat."
          aria-label="What does this do?"
        >ⓘ</span>
      </label>

      <fieldset className="theme-toggle">
        <legend>Theme</legend>
        <label className="radio">
          <input
            type="radio"
            name="theme"
            value="dark"
            checked={theme === "dark"}
            onChange={() => setTheme("dark")}
          />
          <span>Dark</span>
        </label>
        <label className="radio">
          <input
            type="radio"
            name="theme"
            value="light"
            checked={theme === "light"}
            onChange={() => setTheme("light")}
          />
          <span>Light</span>
        </label>
      </fieldset>

      <label>
        <span>Accent color</span>
        <div className="accent-block">
          <input
            type="color"
            className="accent-swatch"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value.toUpperCase())}
            aria-label="Open color picker"
          />
          <input
            type="text"
            className="accent-hex"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={(e) => commitHex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitHex(hexInput);
              }
            }}
            maxLength={7}
            spellCheck={false}
            aria-label="Hex color value"
          />
          <button
            type="button"
            className="accent-copy"
            onClick={copyHex}
            aria-label="Copy hex value"
          >
            {hexCopied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="accent-actions">
          <button type="button" className="accent-twitch-btn" onClick={fetchTwitchColor}>
            {colorFetchStatus === "loading" ? "Fetching…" : "Use my Twitch profile color"}
          </button>
          {colorFetchStatus === "none" && <small>No profile color set on Twitch.</small>}
        </div>
      </label>

      <button type="submit" className="cta" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save"}
      </button>
      {status === "saved" && <span className="saved-toast">Saved ✓</span>}
      {status === "error" && <span className="form-error">Couldn't save — try again.</span>}

    </form>
  );
}
