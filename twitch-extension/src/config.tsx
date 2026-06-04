import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { awaitAuthorized, awaitConfiguration } from "./lib/twitchExt";
import type { TwitchAuth } from "./lib/twitchExt";
import { fetchPanel } from "./lib/api";
import type { PanelResponse } from "./lib/types";
import { SettingsForm } from "./components/SettingsForm";

type State =
  | { kind: "loading" }
  | { kind: "connected"; topDays: string[] }
  | { kind: "warming" }
  | { kind: "no_data" }
  | { kind: "not_in_cp" }
  | { kind: "error"; message: string };

const DASHBOARD = "https://collab.deutschmark.online";
const SIGN_IN = `${DASHBOARD}/?utm_source=twitch_ext&utm_medium=config_view&utm_campaign=not_in_cp`;
const OPEN_DASH = `${DASHBOARD}/?utm_source=twitch_ext&utm_medium=config_view&utm_campaign=connected`;

function StatusStrip({ state }: { state: State }) {
  if (state.kind === "loading") return <p className="loading">Loading…</p>;
  if (state.kind === "error") return <p className="error">Unable to load config.</p>;

  if (state.kind === "not_in_cp") {
    return (
      <>
        <h1>Panel is live ✓</h1>
        <p>
          Predictions are auto-built from this channel's recent broadcasts — no signup needed.
        </p>
        <p className="upgrade-note">
          <strong>Sign in at Collab Planner for sharper forecasts.</strong>
          {" "}Connected accounts get persistent VOD sync, more reliable
          cross-session predictions, and a public schedule even when your
          Twitch VODs are unlisted.
        </p>
        <p>
          <a className="cta-secondary" href={SIGN_IN} target="_blank" rel="noopener noreferrer">
            Sign in (optional) ↗
          </a>
        </p>
      </>
    );
  }

  if (state.kind === "no_data") {
    return (
      <>
        <h1>Panel is live ✓</h1>
        <p>The forecast builds automatically from this channel's broadcast history — it'll populate as recent streams sync. No setup needed.</p>
      </>
    );
  }

  if (state.kind === "warming") {
    return (
      <>
        <h1>Collab Planner ✓</h1>
        <p>Account detected. Analyzing your recent broadcasts — panel will populate within a few minutes.</p>
      </>
    );
  }

  // connected
  return (
    <>
      <h1>Collab Planner ✓</h1>
      <p>
        Account detected. Streams {state.topDays.join(", ") || "various days"}.
      </p>
      <div className="advanced-badge">
        <span className="advanced-badge-dot" aria-hidden="true" />
        Advanced features enabled
      </div>
      <p>
        <a className="cta" href={OPEN_DASH} target="_blank" rel="noopener noreferrer">
          Open dashboard ↗
        </a>
      </p>
    </>
  );
}

function Config() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [authState, setAuthState] = useState<TwitchAuth | null>(null);
  const [configRaw, setConfigRaw] = useState<string | null>(null);

  // The panel CSS hard-locks body overflow to "hidden" so the Twitch
  // iframe never shows scrollbars. The config view shares styles.css
  // but has a long form that needs to scroll — re-enable it here.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    // Preview mode: ?preview=connected|warming|not_in_cp|no_data — bypasses the
    // Twitch JWT dance so the config layout is viewable in a plain browser.
    // Also populates a fake authState so SettingsForm renders for screenshots.
    const params = new URLSearchParams(window.location.search);
    const previewMode = params.get("preview");
    if (previewMode) {
      // Fake auth so the SettingsForm renders below the status strip
      setAuthState({ channelId: "12345", clientId: "preview", token: "preview", helixToken: "", userId: "u1" });
      // Optional ?accent=#RRGGBB lets the capture script preview the
      // form with the SAME accent the rest of the panel uses — so the
      // hex input + color picker + saved swatch all match the screenshot.
      const previewAccent = params.get("accent");
      if (previewAccent && /^#[0-9a-fA-F]{6}$/.test(previewAccent)) {
        setConfigRaw(JSON.stringify({
          v: 1, tz: "America/New_York", use24Hour: false,
          weekStartsMonday: false, accentColor: previewAccent.toUpperCase(),
          theme: "dark",
        }));
      } else {
        setConfigRaw(null);
      }
    }
    if (previewMode === "connected") {
      setState({ kind: "connected", topDays: ["Sun", "Tue", "Mon"] });
      return;
    }
    if (previewMode === "warming") {
      setState({ kind: "warming" });
      return;
    }
    if (previewMode === "not_in_cp" || previewMode === "no_data") {
      setState({ kind: previewMode });
      return;
    }

    Promise.all([awaitAuthorized(), awaitConfiguration()])
      .then(async ([auth, rawCfg]) => {
        setAuthState(auth);
        setConfigRaw(rawCfg);
        try {
          const data: PanelResponse = await fetchPanel(auth.channelId, auth.token, "UTC");
          if (data.status === "ok") {
            setState({
              kind: "connected",
              topDays: data.summary.topDays,
            });
          } else if (data.status === "warming") {
            setState({ kind: "warming" });
          } else {
            setState({ kind: "no_data" });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "unknown";
          if (msg.includes("404")) setState({ kind: "not_in_cp" });
          else setState({ kind: "error", message: msg });
        }
      })
      .catch((err) =>
        setState({ kind: "error", message: err instanceof Error ? err.message : "unknown" })
      );
  }, []);

  return (
    <>
      {/* Wrap the status strip so screenshot captures can hide just
          the connection-state card and leave the bare form visible. */}
      <div className="status-strip-wrap"><StatusStrip state={state} /></div>
      {authState && (
        <SettingsForm
          initialRaw={configRaw}
          channelId={authState.channelId}
          token={authState.token}
        />
      )}
    </>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Config />
    </StrictMode>
  );
}
