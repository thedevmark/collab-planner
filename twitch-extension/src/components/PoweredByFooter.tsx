import { useEffect, useState } from "react";

interface Props {
  campaign: string;
  /** ISO timestamp the panel data was generated. When supplied, shows "as of HH:MM" tick. */
  generatedAt?: string;
}

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PoweredByFooter({ campaign, generatedAt }: Props) {
  const href = `https://collab.deutschmark.online/?utm_source=twitch_ext&utm_medium=panel&utm_campaign=${campaign}`;

  // Tick once a minute so the footer feels alive even when nothing else moves.
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="powered-by">
      {generatedAt && (
        <span className="powered-by-tick" title={`Data refreshed ${formatClock(new Date(generatedAt).getTime())}`}>
          as of {formatClock(nowMs)}
        </span>
      )}
      <a href={href} target="_blank" rel="noopener noreferrer">
        Powered by Collab Planner <span aria-hidden="true">↗</span>
      </a>
    </footer>
  );
}
