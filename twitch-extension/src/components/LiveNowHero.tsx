import { useEffect, useState } from "react";
import type { PanelResponse } from "../lib/types";

type OkResponse = Extract<PanelResponse, { status: "ok" }>;
type LiveNow = NonNullable<OkResponse["liveNow"]>;

interface Props {
  liveNow: LiveNow;
  broadcasterAvatar: string | null;
  broadcasterName: string | null;
}

function formatElapsed(startedAtMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - startedAtMs);
  const totalMin = Math.floor(diff / 60_000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function LiveNowHero({ liveNow, broadcasterAvatar, broadcasterName }: Props) {
  const startedAtMs = new Date(liveNow.startedAt).getTime();
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="schedule live-hero">
      <div className="schedule-toprow">
        <div className="schedule-toprow-left">
          <div className="live-tag">
            <span className="live-dot" aria-hidden />
            <span className="live-label">LIVE NOW</span>
          </div>
          <div className="live-elapsed">{formatElapsed(startedAtMs, nowMs)}</div>
        </div>
        {broadcasterAvatar && (
          <div className="schedule-broadcaster">
            <img className="schedule-avatar" src={broadcasterAvatar} alt="" loading="lazy" />
            {broadcasterName && <div className="schedule-broadcaster-name">{broadcasterName}</div>}
          </div>
        )}
      </div>

      {liveNow.gameName && <div className="live-game">{liveNow.gameName}</div>}
      {liveNow.title && <div className="live-title" title={liveNow.title}>{liveNow.title}</div>}
    </div>
  );
}
