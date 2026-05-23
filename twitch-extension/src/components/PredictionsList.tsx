import type { PanelResponse } from "../lib/types";
import { formatSlot, type FormatOptions } from "../lib/format";

type Predictions = Extract<PanelResponse, { status: "ok" }>["predictions"];

interface Props {
  predictions: Predictions;
  format: FormatOptions;
}

function Stars({ filled }: { filled: 1 | 2 | 3 }) {
  return (
    <span className="stars" aria-label={`confidence ${filled} of 3`}>
      {"★".repeat(filled)}
      <span className="stars-dim">{"★".repeat(3 - filled)}</span>
    </span>
  );
}

export function PredictionsList({ predictions, format }: Props) {
  if (predictions.length === 0) {
    return <p className="empty">No recent broadcast data to analyze yet.</p>;
  }
  return (
    <ul className="predictions">
      {predictions.map((p, idx) => {
        const slot = formatSlot(p.startsAt, format);
        return (
          <li key={`${p.startsAt}-${idx}`} className="prediction">
            <span className="day">{slot.day}</span>
            <span className="time">{slot.time}</span>
            <span className="dur">~{p.durationHours}h</span>
            <span className="meta">
              {p.isPosted ? <span className="badge">Scheduled</span> : <Stars filled={p.confidence} />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
