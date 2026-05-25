import type { PanelResponse } from "../lib/types";
import { formatSlot, type FormatOptions } from "../lib/format";

type Collabs = Extract<PanelResponse, { status: "ok" }>["collabs"];
type Collab = Collabs[number];
type Partner = Collab["partners"][number];

interface Props {
  collabs: Collabs;
  format: FormatOptions;
}

const MAX_SHOWN = 3;

/** Tiny circular avatar that links to the partner's Twitch profile. */
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
  return (
    <li className="collab-row">
      <span className="collab-row-when">{slot.day} {slot.time}</span>
      {collab.partners.length > 0 && (
        <span className="collab-row-who">
          with{" "}
          {collab.partners.map((p, i) => (
            <span key={p.username} className="collab-row-partner-wrap">
              <PartnerLink partner={p} />
              {i < collab.partners.length - 1 && <span className="collab-partner-sep">, </span>}
            </span>
          ))}
        </span>
      )}
      {collab.gameName && (
        <span className="collab-row-game">
          <span className="collab-row-sep">·</span>
          {collab.gameName}
        </span>
      )}
    </li>
  );
}

export function CollabsList({ collabs, format }: Props) {
  if (collabs.length === 0) return null;
  const shown = collabs.slice(0, MAX_SHOWN);
  const extra = collabs.length - shown.length;
  const headerLabel = collabs.length === 1 ? "Next collab" : "Upcoming collabs";

  return (
    <section className="collab-list">
      <div className="collab-list-label">{headerLabel}</div>
      <ul className="collab-list-rows">
        {shown.map((c, i) => (
          <CollabRow key={`${c.startsAt}-${i}`} collab={c} format={format} />
        ))}
      </ul>
      {extra > 0 && (
        <div className="collab-list-more">+ {extra} more</div>
      )}
    </section>
  );
}
