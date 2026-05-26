import { useEffect, useState } from "react";
import type { PanelResponse } from "../lib/types";

type OkResponse = Extract<PanelResponse, { status: "ok" }>;
type LiveNow = NonNullable<OkResponse["liveNow"]>;

interface Props {
  liveNow: LiveNow;
}

function formatElapsed(startedAtMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - startedAtMs);
  const totalMin = Math.floor(diff / 60_000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function LiveNowHero({ liveNow }: Props) {
  const startedAtMs = new Date(liveNow.startedAt).getTime();
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const elapsed = formatElapsed(startedAtMs, nowMs);

  return (
    <div className="schedule live-hero">
      <div className="schedule-eyebrow live-eyebrow">
        <span className="live-dot" aria-hidden />
        Live now
      </div>
      <div className="schedule-hero schedule-hero-live">{elapsed}</div>
      <div className="schedule-support">
        {liveNow.gameName ? (
          <>Streaming <strong>{liveNow.gameName}</strong>.</>
        ) : (
          <>Live right now.</>
        )}
      </div>
      {liveNow.title && (
        <div className="schedule-secondary live-title" title={liveNow.title}>
          {liveNow.title}
        </div>
      )}
    </div>
  );
}
