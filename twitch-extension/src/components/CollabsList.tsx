import type { PanelResponse } from "../lib/types";
import { formatSlot, type FormatOptions } from "../lib/format";

type Collabs = Extract<PanelResponse, { status: "ok" }>["collabs"];

interface Props {
  collabs: Collabs;
  format: FormatOptions;
}

/**
 * Single-line collab teaser. Shows only the next collab to keep the
 * panel uncluttered. No header — the line speaks for itself.
 */
export function CollabsList({ collabs, format }: Props) {
  if (collabs.length === 0) return null;
  const next = collabs[0];
  const slot = formatSlot(next.startsAt, format);
  const firstPartner = next.partners[0];
  const partnerLabel = firstPartner
    ? `@${firstPartner.username}${next.partners.length > 1 ? ` +${next.partners.length - 1}` : ""}`
    : "";

  return (
    <div className="collab-teaser">
      <span className="collab-teaser-label">Next collab</span>
      <span className="collab-teaser-when">{slot.day} {slot.time}</span>
      {partnerLabel && <span className="collab-teaser-who">with {partnerLabel}</span>}
    </div>
  );
}
