import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { awaitAuthorized, awaitConfiguration, type TwitchAuth } from "./lib/twitchExt";
import { fetchPanel } from "./lib/api";
import { fetchLiveStream } from "./lib/helix";
import type { PanelResponse } from "./lib/types";
import { resolveViewerLocale, resolveViewerTimeZone, type FormatOptions } from "./lib/format";
import { parseConfig, DEFAULT_CONFIG, type ExtConfigV1 } from "./lib/configSchema";
import { pickTextColor } from "./lib/contrast";
import { ScheduleSummary } from "./components/ScheduleSummary";
import { Heatmap } from "./components/Heatmap";
import { LoadingHero } from "./components/LoadingHero";
import { NoDataSkeleton } from "./components/NoDataSkeleton";

const WARMING_RETRY_MS = 5_000;

/** A stream that started yesterday and is still running into today
 *  is NOT "today's stream" — today's typical window is still an
 *  upcoming, separate stream. Only skip today as a next-stream
 *  candidate when the current live stream actually started today
 *  (in the broadcaster's timezone). Without this guard, a midnight-
 *  crossing stream incorrectly bumps the next-stream prediction past
 *  today's typical slot (e.g. "next: Saturday" when today's Wednesday
 *  evening stream is still ahead). */
function liveStartedToday(
  liveNow: { startedAt: string } | null | undefined,
  tz: string,
): boolean {
  if (!liveNow) return false;
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" });
  return fmt.format(new Date(liveNow.startedAt)) === fmt.format(new Date());
}

function Panel() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; data: Extract<PanelResponse, { status: "ok" }>; fmt: FormatOptions }
    | { kind: "warming"; fmt: FormatOptions }
    | { kind: "no_data"; fmt: FormatOptions }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  const [config, setConfig] = useState<ExtConfigV1>(DEFAULT_CONFIG);
  const [auth, setAuth] = useState<TwitchAuth | null>(null);

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
        // Two distinct mock streamers so the marketing kit can show
        // the panel populated with different broadcaster contexts.
        // Default preview = thedeutschmark (M/W/Sat evening streamer).
        // ?preview=ok2 = stellarvolt (T/Th/Sat late-night streamer).
        const mock: Extract<PanelResponse, { status: "ok" }> = previewMode === "ok2"
          ? {
              status: "ok",
              summary: {
                // Mon/Thu/Sat evening streamer — distinct day pattern
                // AND time from the main thedeutschmark mock, so the
                // marketing kit shows real variety across broadcasters.
                topDays: ["Thu", "Sat", "Sun"],
                // Afternoon streamer — Thursday is the next-up day from
                // Mon evening fake-now (deutschmark covers Wed already
                // in the other panel, so a1exzandra picks up Thu/Sat/
                // Sun for visual variety in the marketing kit).
                medianHour: 13,
                tz: "America/New_York",
                isEstimate: false,
                hasPostedSchedule: true,
                hourDistribution: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.95, 1.0, 0.95, 0.6, 0.3, 0, 0, 0, 0, 0, 0],
                dayFrequency: [0.85, 0.2, 0.2, 0.2, 0.95, 0.2, 0.9],
                avgDurationHours: 5,
                // startHour values are pre-shifted by -0.5h because the
                // Heatmap adds medianMinute (=30 → +0.5h) as a global
                // offset. Pre-shifting lets each day render at its true
                // intended start: Thu at 13:30, Sat at 14:30, Sun at 12:30.
                perDay: [
                  { dow: 4, startHour: 13, durationHours: 5, confidence: "high" },
                  { dow: 6, startHour: 14, durationHours: 5, confidence: "high" },
                  { dow: 0, startHour: 12, durationHours: 5, confidence: "high" },
                ],
                sampleSize: 42,
                medianMinute: 30,
                broadcasterAvatar: null,
                broadcasterName: "a1exzandra",
              },
              lastStream: { startedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), gameName: "Just Chatting", durationSec: 4 * 3600 },
              liveNow: null,
              generatedAt: new Date().toISOString(),
            }
          : {
              status: "ok",
              summary: {
                topDays: ["Mon", "Wed", "Sat"],
                medianHour: 19,
                tz: "America/New_York",
                isEstimate: false,
                hasPostedSchedule: true,
                hourDistribution: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.9, 1.0, 0.9, 0.6, 0.3],
                dayFrequency: [0.2, 1.0, 0.2, 0.9, 0.3, 0.2, 0.8],
                avgDurationHours: 5,
                perDay: [
                  { dow: 1, startHour: 19, durationHours: 5, confidence: "high" },
                  { dow: 3, startHour: 19, durationHours: 5, confidence: "high" },
                  { dow: 6, startHour: 18, durationHours: 5, confidence: "high" },
                ],
                sampleSize: 30,
                medianMinute: 0,
                broadcasterAvatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/54c170ef-e1d0-463d-adda-922e751ef6b8-profile_image-300x300.png",
                broadcasterName: "thedeutschmark",
              },
              lastStream: { startedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), gameName: "Fortnite", durationSec: 5 * 3600 },
              liveNow:
                previewMode === "live"
                  ? {
                      // 3h17m elapsed — odd elapsed time so the bar's
                      // leading edge lands at an off-hour minute on the
                      // axis (10:17 PM vs the tick at 10 PM), reading
                      // as a real in-progress stream instead of a staged
                      // round-hour snapshot.
                      startedAt: new Date(Date.now() - 3 * 3600_000 - 17 * 60_000).toISOString(),
                      gameName: "Fortnite",
                      title: "ranked grind to masters w/ friends",
                    }
                  : null,
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
      .then(async ([authResult, rawCfg]) => {
        const cfg = parseConfig(rawCfg);
        document.documentElement.style.setProperty("--accent", cfg.accentColor);
        document.documentElement.style.setProperty("--accent-text", pickTextColor(cfg.accentColor));
        document.documentElement.dataset.theme = cfg.theme;
        setConfig(cfg);
        // Surface auth to the live-poll effect — it needs channelId,
        // helixToken, and clientId to hit Helix directly from the panel.
        setAuth(authResult);
        const fmt: FormatOptions = {
          locale: resolveViewerLocale(undefined),
          timeZone: resolveViewerTimeZone(),
        };
        return load(authResult, fmt, cfg);
      })
      .catch((err) =>
        setState({ kind: "error", message: err instanceof Error ? err.message : "unknown" })
      );

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // ── Live-now polling via the Helix token in the extension JWT ──
  // Backend cache for unconnected channels is 24h; the initial payload
  // has fresh liveNow but subsequent renders would go stale without
  // this. Polling Helix directly from the panel keeps the LIVE
  // indicator current within ~60s of the broadcaster going on/off air,
  // and saves a backend round-trip per minute per viewer.
  useEffect(() => {
    if (!auth || !auth.helixToken || !auth.channelId) return;
    let cancelled = false;
    const poll = async () => {
      const live = await fetchLiveStream(auth.channelId, auth.helixToken, auth.clientId);
      if (cancelled) return;
      setState((s) => {
        if (s.kind !== "ok") return s;
        return { ...s, data: { ...s.data, liveNow: live } };
      });
    };
    const id = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [auth]);

  if (state.kind === "loading") return <LoadingHero />;
  if (state.kind === "warming") return <LoadingHero />;
  if (state.kind === "error") return <p className="error">Unable to load panel.</p>;
  if (state.kind === "no_data") return <NoDataSkeleton />;

  return (
    <>
      {/* Same schedule text regardless of live state — the viewer's
          primary question is always "when's the NEXT stream", even
          while watching the current one. Live signal moves to the
          calendar overlay below. */}
      <ScheduleSummary
        summary={state.data.summary}
        use24Hour={config.use24Hour}
        skipToday={liveStartedToday(state.data.liveNow, state.data.summary.tz)}
      />
      <Heatmap
        perDay={state.data.summary.perDay}
        topDays={state.data.summary.topDays}
        medianHour={state.data.summary.medianHour}
        tz={state.data.summary.tz}
        sampleSize={state.data.summary.sampleSize}
        hasPostedSchedule={state.data.summary.hasPostedSchedule}
        use24Hour={config.use24Hour}
        weekStartsMonday={config.weekStartsMonday}
        medianMinute={state.data.summary.medianMinute}
        liveNow={state.data.liveNow}
      />
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
