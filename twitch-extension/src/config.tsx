import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { awaitAuthorized } from "./lib/twitchExt";
import { fetchPanel } from "./lib/api";
import type { PanelResponse } from "./lib/types";

type State =
  | { kind: "loading" }
  | { kind: "connected"; predictions: number; collabs: number }
  | { kind: "warming" }
  | { kind: "no_data" }
  | { kind: "not_in_cp" }
  | { kind: "error"; message: string };

const DASHBOARD = "https://collab.deutschmark.online";
const SIGN_IN = `${DASHBOARD}/?utm_source=twitch_ext&utm_medium=config_view&utm_campaign=not_in_cp`;
const OPEN_DASH = `${DASHBOARD}/?utm_source=twitch_ext&utm_medium=config_view&utm_campaign=connected`;

function Config() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    awaitAuthorized()
      .then(async (auth) => {
        try {
          const data: PanelResponse = await fetchPanel(auth.channelId, auth.token);
          if (data.status === "ok") {
            setState({
              kind: "connected",
              predictions: data.predictions.length,
              collabs: data.collabs.length,
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

  if (state.kind === "loading") return <p className="loading">Loading…</p>;
  if (state.kind === "error") return <p className="error">Unable to load config.</p>;

  if (state.kind === "not_in_cp" || state.kind === "no_data") {
    return (
      <>
        <h1>Collab Planner</h1>
        <p>
          Your channel isn't connected yet. Sign in with Twitch at Collab Planner — your panel
          will start working automatically.
        </p>
        <p>
          <a className="cta" href={SIGN_IN} target="_blank" rel="noopener noreferrer">
            Sign in with Twitch ↗
          </a>
        </p>
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

  return (
    <>
      <h1>Collab Planner ✓</h1>
      <p>
        Account detected. {state.predictions} predicted slot{state.predictions === 1 ? "" : "s"},{" "}
        {state.collabs} upcoming collab{state.collabs === 1 ? "" : "s"}.
      </p>
      <p>
        <a className="cta" href={OPEN_DASH} target="_blank" rel="noopener noreferrer">
          Open dashboard ↗
        </a>
      </p>
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
