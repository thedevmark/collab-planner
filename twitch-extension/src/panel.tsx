import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { awaitAuthorized, awaitConfiguration, type TwitchAuth } from "./lib/twitchExt";
import { fetchPanel } from "./lib/api";
import type { PanelResponse } from "./lib/types";
import { resolveViewerLocale, resolveViewerTimeZone, type FormatOptions } from "./lib/format";
import { parseConfig, DEFAULT_CONFIG, type ExtConfigV1 } from "./lib/configSchema";
import { pickTextColor } from "./lib/contrast";
import { ScheduleSummary } from "./components/ScheduleSummary";
import { CollabsList } from "./components/CollabsList";
import { PoweredByFooter } from "./components/PoweredByFooter";
import { Heatmap } from "./components/Heatmap";
import { LastLive } from "./components/LastLive";
import { RecentGames } from "./components/RecentGames";

const WARMING_RETRY_MS = 5_000;

function Panel() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; data: Extract<PanelResponse, { status: "ok" }>; fmt: FormatOptions }
    | { kind: "warming"; fmt: FormatOptions }
    | { kind: "no_data"; fmt: FormatOptions }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  const [config, setConfig] = useState<ExtConfigV1>(DEFAULT_CONFIG);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Preview mode: ?preview=ok|warming|no_data|empty bypasses the Twitch JWT
    // dance and renders the panel against fixed mock data.
    const previewMode = new URLSearchParams(window.location.search).get("preview");
    if (previewMode) {
      const fmt: FormatOptions = {
        locale: resolveViewerLocale(undefined),
        timeZone: resolveViewerTimeZone(),
      };
      if (previewMode === "warming") {
        setState({ kind: "warming", fmt });
      } else if (previewMode === "no_data") {
        setState({ kind: "no_data", fmt });
      } else {
        const mock: Extract<PanelResponse, { status: "ok" }> = {
          status: "ok",
          summary: {
            topDays: ["Sun", "Tue", "Mon"],
            medianHour: 23, // ~7PM ET
            tz: "America/New_York",
            topGame: "Apex Legends",
            topGames: ["Apex Legends", "Just Chatting", "Fortnite", "League of Legends"],
            isEstimate: false,
            hasPostedSchedule: true,
            // Realistic concentrated evening pattern — peak at 22-24 UTC.
            // Range detector stays quiet (IQR < 2h) so hero renders single time.
            hourDistribution: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 1.0, 0.8],
            dayFrequency: [1.0, 0.8, 0.3, 0.9, 0.4, 0.3, 0.6],
            avgDurationHours: 4,
            broadcasterAvatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/54c170ef-e1d0-463d-adda-922e751ef6b8-profile_image-300x300.png",
            broadcasterName: "thedeutschmark",
          },
          lastStream: { startedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), gameName: "Apex Legends", durationSec: 5 * 3600 },
          collabs:
            previewMode === "empty"
              ? []
              : [
                  {
                    startsAt: nextDayAt(6, 18, 0),
                    gameName: "Apex Legends",
                    partners: [
                      { username: "alice", displayName: "Alice", avatarUrl: "" },
                      { username: "bob", displayName: "Bob", avatarUrl: "" },
                    ],
                  },
                  {
                    startsAt: nextDayAt(2, 20, 0),
                    gameName: "Marvel Rivals",
                    partners: [{ username: "carl", displayName: "Carl", avatarUrl: "" }],
                  },
                  {
                    startsAt: nextDayAt(4, 19, 0),
                    gameName: null,
                    partners: [
                      { username: "dora", displayName: "Dora", avatarUrl: "" },
                      { username: "evan", displayName: "Evan", avatarUrl: "" },
                      { username: "fran", displayName: "Fran", avatarUrl: "" },
                    ],
                  },
                ],
          generatedAt: new Date().toISOString(),
        };
        setState({ kind: "ok", data: mock, fmt });
      }
      return () => {
        cancelled = true;
      };
    }

    async function load(auth: TwitchAuth, fmt: FormatOptions, cfg: ExtConfigV1) {
      try {
        const data = await fetchPanel(auth.channelId, auth.token, cfg.tz);
        if (cancelled) return;
        if (data.status === "ok") setState({ kind: "ok", data, fmt });
        else if (data.status === "warming") {
          setState({ kind: "warming", fmt });
          timer = setTimeout(() => load(auth, fmt, cfg), WARMING_RETRY_MS);
        } else setState({ kind: "no_data", fmt });
      } catch (err) {
        if (!cancelled) {
          setState({ kind: "error", message: err instanceof Error ? err.message : "unknown" });
        }
      }
    }

    Promise.all([awaitAuthorized(), awaitConfiguration()])
      .then(async ([auth, rawCfg]) => {
        const cfg = parseConfig(rawCfg);
        document.documentElement.style.setProperty("--accent", cfg.accentColor);
        document.documentElement.style.setProperty("--accent-text", pickTextColor(cfg.accentColor));
        setConfig(cfg);
        const fmt: FormatOptions = {
          locale: resolveViewerLocale(undefined),
          timeZone: resolveViewerTimeZone(),
        };
        return load(auth, fmt, cfg);
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
        <p className="empty">No stream data yet.</p>
        <PoweredByFooter campaign="panel_empty" />
      </>
    );

  return (
    <>
      <ScheduleSummary summary={state.data.summary} />
      <Heatmap
        topDays={state.data.summary.topDays}
        medianHour={state.data.summary.medianHour}
        avgDurationHours={state.data.summary.avgDurationHours}
        dayFrequency={state.data.summary.dayFrequency}
      />
      {config.showGame && <RecentGames games={state.data.summary.topGames} />}
      <LastLive lastStream={state.data.lastStream} />
      {config.showCollabs && <CollabsList collabs={state.data.collabs} format={state.fmt} />}
      <PoweredByFooter campaign="panel_footer" />
    </>
  );
}

// Preview-mode helper: ISO timestamp for the next given weekday at H:MM local.
function nextDayAt(targetDow: number, hour: number, minute: number): string {
  const d = new Date();
  const diff = (targetDow - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Panel />
    </StrictMode>
  );
}
