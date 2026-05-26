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
import { LiveNowHero } from "./components/LiveNowHero";
import { NoDataSkeleton } from "./components/NoDataSkeleton";

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
            topDays: ["Mon", "Wed", "Sat"],
            medianHour: 19, // 7 PM local
            tz: "America/New_York",
            topGame: "Fortnite",
            topGames: ["Fortnite", "Just Chatting", "League of Legends"],
            isEstimate: false,
            hasPostedSchedule: true,
            // Spread evening hours: ramps up 6-8 PM, peaks 8-10, tails to midnight.
            hourDistribution: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.9, 1.0, 0.9, 0.6, 0.3],
            // Mon + Wed + Sat are the regulars; everything else background noise.
            dayFrequency: [0.2, 1.0, 0.2, 0.9, 0.3, 0.2, 0.8],
            avgDurationHours: 5,
            perDay: [
              { dow: 1, startHour: 19, durationHours: 5, confidence: "high" },
              { dow: 3, startHour: 19, durationHours: 5, confidence: "high" },
              { dow: 6, startHour: 18, durationHours: 5, confidence: "high" },
            ],
            broadcasterAvatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/54c170ef-e1d0-463d-adda-922e751ef6b8-profile_image-300x300.png",
            broadcasterName: "thedeutschmark",
          },
          lastStream: { startedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), gameName: "Fortnite", durationSec: 5 * 3600 },
          liveNow:
            previewMode === "live"
              ? {
                  startedAt: new Date(Date.now() - 2 * 3600_000 - 14 * 60_000).toISOString(),
                  gameName: "Fortnite",
                  title: "ranked grind to masters w/ friends",
                }
              : null,
          collabs:
            previewMode === "empty"
              ? []
              : [
                  {
                    startsAt: nextDayAt(6, 18, 0),
                    gameName: "Fortnite",
                    partners: [
                      {
                        username: "koryzma",
                        displayName: "Koryzma",
                        avatarUrl:
                          "https://static-cdn.jtvnw.net/jtv_user_pictures/32f841b7-5ed9-4da5-81e0-75e54fb0c36c-profile_image-300x300.png",
                      },
                      {
                        username: "a1exzandra",
                        displayName: "a1exzandra",
                        avatarUrl:
                          "https://static-cdn.jtvnw.net/jtv_user_pictures/90421d89-eaf5-4daa-9ed4-492a216d557f-profile_image-300x300.png",
                      },
                    ],
                  },
                  {
                    startsAt: nextDayAt(2, 20, 0),
                    gameName: "Phasmophobia",
                    partners: [
                      {
                        username: "definitelynotmadi",
                        displayName: "definitelynotmadi",
                        avatarUrl:
                          "https://static-cdn.jtvnw.net/jtv_user_pictures/650518e3-c3d6-4ca0-8391-73fb83b4c22c-profile_image-300x300.png",
                      },
                    ],
                  },
                  {
                    startsAt: nextDayAt(4, 19, 0),
                    gameName: null,
                    partners: [
                      {
                        username: "dangerdork",
                        displayName: "DANGERDORK",
                        avatarUrl:
                          "https://static-cdn.jtvnw.net/jtv_user_pictures/32aa3abd-3e67-4cb8-a81e-b48e61d68a88-profile_image-300x300.jpeg",
                      },
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
        <NoDataSkeleton />
        <PoweredByFooter campaign="panel_empty" />
      </>
    );

  return (
    <>
      {state.data.liveNow ? (
        <LiveNowHero liveNow={state.data.liveNow} />
      ) : (
        <ScheduleSummary summary={state.data.summary} />
      )}
      <Heatmap
        topDays={state.data.summary.topDays}
        medianHour={state.data.summary.medianHour}
        avgDurationHours={state.data.summary.avgDurationHours}
        dayFrequency={state.data.summary.dayFrequency}
      />
      {config.showCollabs && (
        <CollabsList
          collabs={state.data.collabs}
          format={state.fmt}
          broadcasterName={state.data.summary.broadcasterName}
        />
      )}
      <PoweredByFooter campaign="panel_footer" generatedAt={state.data.generatedAt} />
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
