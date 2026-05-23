import type { PanelResponse } from "../lib/types";
import { formatSlot, type FormatOptions } from "../lib/format";

type Collabs = Extract<PanelResponse, { status: "ok" }>["collabs"];

interface Props {
  collabs: Collabs;
  format: FormatOptions;
}

export function CollabsList({ collabs, format }: Props) {
  if (collabs.length === 0) return null;
  return (
    <section className="collabs">
      <h2>Upcoming collabs</h2>
      <ul>
        {collabs.map((c, idx) => {
          const slot = formatSlot(c.startsAt, format);
          const names = c.partners.map((p) => `@${p.username}`).join(" ");
          return (
            <li key={`${c.startsAt}-${idx}`} className="collab">
              <div>
                <span className="day">{slot.day}</span> <span className="time">{slot.time}</span>
              </div>
              <div className="partners">with {names}</div>
              {c.gameName && <div className="game">{c.gameName}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
