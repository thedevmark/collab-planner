// twitch-extension/src/components/SettingsForm.tsx
import { useMemo, useState } from "react";
import { parseConfig, serializeConfig, type ExtConfigV1 } from "../lib/configSchema";
import { setBroadcasterConfiguration } from "../lib/twitchExt";

const CONFIG_VERSION = "1";
const API_BASE = "https://collab.deutschmark.online";

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
  const [showCollabs, setShowCollabs] = useState(initial.showCollabs);
  const [showGame, setShowGame] = useState(initial.showGame);
  const [accentColor, setAccentColor] = useState(initial.accentColor);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [colorFetchStatus, setColorFetchStatus] = useState<"idle" | "loading" | "none">("idle");

  const tzOptions = useMemo(() => {
    type SupportedValuesOf = (key: "timeZone") => string[];
    const supported = (Intl as unknown as { supportedValuesOf?: SupportedValuesOf }).supportedValuesOf;
    return supported ? supported("timeZone") : [];
  }, []);

  async function fetchTwitchColor() {
    setColorFetchStatus("loading");
    try {
      const res = await fetch(
        `${API_BASE}/api/extension/channel/${channelId}/twitch-color`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const body = await res.json();
      if (body.color) {
        setAccentColor(body.color);
        setColorFetchStatus("idle");
      } else {
        setColorFetchStatus("none");
      }
    } catch {
      setColorFetchStatus("none");
    }
  }

  function buildConfig(): ExtConfigV1 {
    return {
      v: 1,
      tz,
      showCollabs,
      showGame,
      accentColor,
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
          {/* If the current tz is not in the IANA list (very rare), still show it so the value persists */}
          {!tzOptions.includes(tz) && <option value={tz}>{tz}</option>}
          {tzOptions.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <small>This setting is separate from your Collab Planner timezone.</small>
      </label>

      <label className="checkbox">
        <input type="checkbox" checked={showCollabs} onChange={(e) => setShowCollabs(e.target.checked)} />
        <span>Show upcoming collabs</span>
      </label>

      <label className="checkbox">
        <input type="checkbox" checked={showGame} onChange={(e) => setShowGame(e.target.checked)} />
        <span>Show top game</span>
      </label>

      <label>
        <span>Accent color</span>
        <span className="accent-row">
          <input
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value.toUpperCase())}
          />
          <button type="button" onClick={fetchTwitchColor}>
            {colorFetchStatus === "loading" ? "Fetching…" : "Use my Twitch profile color"}
          </button>
          {colorFetchStatus === "none" && <small>No Twitch chat color set on your account.</small>}
        </span>
      </label>

      <button type="submit" className="cta" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save"}
      </button>
      {status === "saved" && <span className="saved-toast">Saved ✓</span>}
      {status === "error" && <span className="form-error">Couldn't save — try again.</span>}
    </form>
  );
}
