interface Props {
  lastStream: { startedAt: string; gameName: string | null; durationSec: number } | null;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.round(diffDay / 30);
  return `${diffMonth}mo ago`;
}

function durationLabel(durationSec: number): string {
  const hours = Math.round(durationSec / 3600);
  return `${hours}h`;
}

export function LastLive({ lastStream }: Props) {
  if (!lastStream) return null;
  const when = relativeTime(lastStream.startedAt);
  const game = lastStream.gameName ?? "";
  const dur = lastStream.durationSec > 0 ? durationLabel(lastStream.durationSec) : "";
  const parts: string[] = [`Last live: ${when}`];
  if (game) parts.push(game);
  if (dur) parts.push(dur);
  return <div className="last-live">{parts.join(" · ")}</div>;
}
