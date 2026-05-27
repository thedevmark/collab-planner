import { useMinuteTick } from "../lib/useMinuteTick";

interface Props {
  campaign: string;
  /** ISO timestamp the panel data was generated. When supplied, shows "as of HH:MM" tick. */
  generatedAt?: string;
  /** When true, shows a small pulsing dot to the left of the "as of" timestamp,
   *  signalling that the broadcaster has a posted Twitch schedule backing the
   *  prediction. */
  hasPostedSchedule?: boolean;
  /** IANA tz of the broadcaster. The "as of" clock is formatted in this tz so
   *  the timestamp matches the streamer's local clock; the simplified short
   *  (EST/PST/CST/etc.) is appended after the time. */
  tz?: string;
  /** When true, show the "as of" clock as 24-hour ("19:42" not "7:42 PM"). */
  use24Hour?: boolean;
}

function formatClock(ms: number, tz?: string, use24Hour?: boolean): string {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: use24Hour ? "2-digit" : "numeric",
    minute: "2-digit",
    timeZone: tz,
    hour12: !use24Hour,
  });
}

/** Get the streamer-friendly short tz abbreviation (year-round Standard
 *  variant — EST/PST/CST/etc., no DST flip). */
function getTzShort(tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" });
    const raw = fmt.formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? tz;
    const us = raw.match(/^(E|C|M|P|A|H)(D|S)T$/);
    if (us) return `${us[1]}ST`;
    if (/^AK[DS]T$/.test(raw)) return "AKST";
    return raw;
  } catch {
    return tz;
  }
}

export function PoweredByFooter({ campaign, generatedAt, hasPostedSchedule, tz, use24Hour }: Props) {
  const href = `https://collab.deutschmark.online/?utm_source=twitch_ext&utm_medium=panel&utm_campaign=${campaign}`;

  const nowMs = useMinuteTick();

  return (
    <footer className="powered-by">
      {generatedAt && (
        <span className="powered-by-tick" title={`Data refreshed ${formatClock(new Date(generatedAt).getTime(), tz, use24Hour)}`}>
          {hasPostedSchedule && (
            <span className="powered-by-posted-dot" aria-hidden="true" title="Broadcaster has a posted Twitch schedule" />
          )}
          as of {formatClock(nowMs, tz, use24Hour)}
          {tz && <> {getTzShort(tz)}</>}
        </span>
      )}
      <a href={href} target="_blank" rel="noopener noreferrer">
        Powered by Collab Planner <span aria-hidden="true">↗</span>
      </a>
    </footer>
  );
}
