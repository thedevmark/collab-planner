import type { PanelResponse } from "../lib/types";
import { formatSlot, type FormatOptions } from "../lib/format";

type Collabs = Extract<PanelResponse, { status: "ok" }>["collabs"];
type Collab = Collabs[number];
type Partner = Collab["partners"][number];

interface Props {
  collabs: Collabs;
  format: FormatOptions;
  broadcasterName: string | null;
}

const MAX_SHOWN = 2;
const ART_W = 48;
const ART_H = 64;
const PLAN_BASE = "https://collab.deutschmark.online/plan";

function boxArtUrl(gameName: string): string {
  return `https://static-cdn.jtvnw.net/ttv-boxart/${encodeURIComponent(gameName)}-${ART_W * 2}x${ART_H * 2}.jpg`;
}

function directoryUrl(gameName: string): string {
  return `https://www.twitch.tv/directory/category/${encodeURIComponent(gameName.toLowerCase().replace(/\s+/g, "-"))}`;
}

// Twitch logins are lowercase. broadcasterName is the display_name, which
// matches the login when lowercased in the overwhelming majority of cases —
// good enough for a deeplink that the app re-resolves on load.
function planWithLink(broadcasterName: string | null): string {
  if (!broadcasterName) return PLAN_BASE;
  return `${PLAN_BASE}?addFriend=${encodeURIComponent(broadcasterName.toLowerCase())}`;
}

function PartnerLink({ partner }: { partner: Partner }) {
  const href = `https://twitch.tv/${partner.username}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="collab-partner-link"
      title={partner.displayName || partner.username}
    >
      {partner.avatarUrl ? (
        <img
          src={partner.avatarUrl}
          alt=""
          className="collab-partner-avatar"
          loading="lazy"
        />
      ) : (
        <span className="collab-partner-avatar collab-partner-avatar-fallback">
          {(partner.displayName || partner.username).charAt(0).toUpperCase()}
        </span>
      )}
      <span className="collab-partner-name">@{partner.username}</span>
    </a>
  );
}

function CollabRow({ collab, format }: { collab: Collab; format: FormatOptions }) {
  const slot = formatSlot(collab.startsAt, format);
  const game = collab.gameName;

  return (
    <li className="collab-row">
      {game ? (
        <a
          className="collab-row-art"
          href={directoryUrl(game)}
          target="_blank"
          rel="noopener noreferrer"
          title={game}
          style={{ width: ART_W, height: ART_H }}
        >
          <img
            src={boxArtUrl(game)}
            alt=""
            loading="lazy"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = "0")}
          />
        </a>
      ) : (
        <div
          className="collab-row-art collab-row-art-empty"
          style={{ width: ART_W, height: ART_H }}
        />
      )}

      <div className="collab-row-body">
        <div className="collab-row-when">
          {slot.day} <span className="collab-row-when-sep">·</span> {slot.time}
        </div>
        {collab.partners.length > 0 && (
          <div className="collab-row-who">
            with{" "}
            {collab.partners.map((p, i) => (
              <span key={p.username} className="collab-row-partner-wrap">
                <PartnerLink partner={p} />
                {i < collab.partners.length - 1 && <span className="collab-partner-sep">, </span>}
              </span>
            ))}
          </div>
        )}
        {game && <div className="collab-row-game">{game}</div>}
      </div>
    </li>
  );
}

export function CollabsList({ collabs, format, broadcasterName }: Props) {
  const shown = collabs.slice(0, MAX_SHOWN);
  const extra = collabs.length - shown.length;
  const headerLabel = collabs.length === 1 ? "Next collab" : "Upcoming collabs";

  return (
    <section className="collab-list">
      <div className="collab-list-label">{headerLabel}</div>

      {collabs.length === 0 ? (
        <a
          className="collab-empty"
          href={planWithLink(broadcasterName)}
          target="_blank"
          rel="noopener noreferrer"
        >
          No upcoming collabs —{" "}
          <span className="collab-empty-cta">plan one with me ↗</span>
        </a>
      ) : (
        <>
          <ul className="collab-list-rows">
            {shown.map((c, i) => (
              <CollabRow key={`${c.startsAt}-${i}`} collab={c} format={format} />
            ))}
          </ul>
          {extra > 0 && <div className="collab-list-more">+ {extra} more</div>}
        </>
      )}
    </section>
  );
}
