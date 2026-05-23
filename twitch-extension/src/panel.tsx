import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { awaitAuthorized, type TwitchAuth } from "./lib/twitchExt";
import { fetchPanel } from "./lib/api";
import type { PanelResponse } from "./lib/types";
import { resolveViewerLocale, resolveViewerTimeZone, type FormatOptions } from "./lib/format";
import { PredictionsList } from "./components/PredictionsList";
import { CollabsList } from "./components/CollabsList";
import { PoweredByFooter } from "./components/PoweredByFooter";

const WARMING_RETRY_MS = 5_000;

function Panel() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; data: Extract<PanelResponse, { status: "ok" }>; fmt: FormatOptions }
    | { kind: "warming"; fmt: FormatOptions }
    | { kind: "no_data"; fmt: FormatOptions }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(auth: TwitchAuth, fmt: FormatOptions) {
      try {
        const data = await fetchPanel(auth.channelId, auth.token);
        if (cancelled) return;
        if (data.status === "ok") setState({ kind: "ok", data, fmt });
        else if (data.status === "warming") {
          setState({ kind: "warming", fmt });
          timer = setTimeout(() => load(auth, fmt), WARMING_RETRY_MS);
        } else setState({ kind: "no_data", fmt });
      } catch (err) {
        if (!cancelled) {
          setState({ kind: "error", message: err instanceof Error ? err.message : "unknown" });
        }
      }
    }

    awaitAuthorized()
      .then((auth) => {
        const fmt: FormatOptions = {
          locale: resolveViewerLocale(undefined),
          timeZone: resolveViewerTimeZone(),
        };
        return load(auth, fmt);
      })
      .catch((err) =>
        setState({ kind: "error", message: err instanceof Error ? err.message : "unknown" })
      );

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (state.kind === "loading") return <p className="loading">Loading…</p>;
  if (state.kind === "warming") return <p className="loading">Analyzing recent broadcasts…</p>;
  if (state.kind === "error") return <p className="error">Unable to load panel.</p>;
  if (state.kind === "no_data")
    return (
      <>
        <h1>Likely upcoming streams</h1>
        <p className="empty">No recent broadcast data to analyze yet.</p>
        <PoweredByFooter campaign="panel_empty" />
      </>
    );

  return (
    <>
      <h1>Likely upcoming streams</h1>
      <PredictionsList predictions={state.data.predictions} format={state.fmt} />
      <CollabsList collabs={state.data.collabs} format={state.fmt} />
      <PoweredByFooter campaign="panel_footer" />
    </>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Panel />
    </StrictMode>
  );
}
