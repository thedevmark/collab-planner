"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import {
  buildScheduleVariantData,
  type ScheduleVariantData,
} from "@/lib/scheduling/narrative";

interface PatternSummary {
  topDays: string[];
  medianHour: number;
  tz: string;
  topGame: string | null;
  isEstimate: boolean;
  hasPostedSchedule: boolean;
  avgDurationHours?: number;
}

interface Props {
  summary: PatternSummary | null;
  accentColor: string;
  source: "estimated" | "schedule" | "history" | "mixed";
  totalStreams: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function renderTzChip(tzShort: string, tzLong: string): ReactNode {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1 cursor-help align-top"
      title={tzLong}
    >
      {tzShort}
    </span>
  );
}

function renderSupport(v: ScheduleVariantData): ReactNode {
  const tz = renderTzChip(v.parts.tzShort, v.parts.tzLong);
  switch (v.key) {
    case "no-pattern":
      return "No regular streaming pattern yet.";
    case "imminent":
      return (
        <>
          <strong className="font-bold text-foreground">{v.parts.fullDay}s</strong>{" "}
          ·{" "}
          <strong className="font-bold text-foreground">
            {v.parts.start} to {v.parts.end}
          </strong>{" "}
          {tz}
        </>
      );
    case "today":
      return (
        <>
          Usually <strong className="font-bold text-foreground">{v.parts.fullDay}s</strong>{" "}
          around <strong className="font-bold text-foreground">{v.parts.start}</strong> {tz}.
        </>
      );
    case "tomorrow":
      return (
        <>
          <strong className="font-bold text-foreground">{v.parts.fullDay}</strong> around{" "}
          <strong className="font-bold text-foreground">{v.parts.start}</strong> {tz}.
        </>
      );
    case "future":
      return (
        <>
          <strong className="font-bold text-foreground">{v.parts.relative}</strong> ·
          around <strong className="font-bold text-foreground">{v.parts.start}</strong>{" "}
          {tz}.
        </>
      );
  }
}

function renderSecondary(v: ScheduleVariantData): ReactNode {
  if (v.key === "tomorrow" || v.key === "future") {
    return <>Usually {v.parts.dayList}.</>;
  }
  return null;
}

function sourceBadgeLabel(source: Props["source"], totalStreams: number): string {
  if (source === "estimated") return "estimated";
  if (source === "schedule") return "from schedule";
  if (source === "mixed") return `${totalStreams} streams + schedule`;
  return `${totalStreams} streams`;
}

export function StreamingPatternCard({ summary, accentColor, source, totalStreams }: Props) {
  // Tick once a minute so the "Tonight's stream in 4h 23m" countdown stays current.
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!summary || source === "estimated") {
    return (
      <Card>
        <CardContent className="pt-5 pb-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70 inline-flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" />
              Streaming pattern
            </span>
            <Badge variant="outline" className="text-[10px]">
              {sourceBadgeLabel(source, totalStreams)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground py-2">
            No stream history or schedule found for this streamer yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const v = buildScheduleVariantData({
    topDays: summary.topDays,
    medianHour: summary.medianHour,
    avgDurationHours: summary.avgDurationHours ?? 3,
    tz: summary.tz,
    nowMs,
  });

  const eyebrowText = summary.isEstimate ? `${v.eyebrow} (est.)` : v.eyebrow;
  const heroColor =
    v.heroTone === "dim" ? "#3a3a3d" : v.heroTone === "live" ? "#ff5c5c" : accentColor;

  return (
    <Card>
      <CardContent className="pt-5 pb-5 space-y-3">
        {/* Eyebrow row: label on left, source badge on right */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70 inline-flex items-center gap-1.5">
            {eyebrowText}
            {summary.hasPostedSchedule && (
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"
                title="Has posted Twitch schedule"
              />
            )}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {sourceBadgeLabel(source, totalStreams)}
          </Badge>
        </div>

        {/* Hero — huge, accent-colored */}
        <div
          className="text-[44px] font-extrabold tracking-tight leading-none tabular-nums"
          style={{ color: heroColor }}
        >
          {v.hero}
        </div>

        {/* Support sentence */}
        <div className="text-sm text-muted-foreground leading-snug">{renderSupport(v)}</div>

        {/* Optional secondary line */}
        {renderSecondary(v) && (
          <div className="text-xs text-muted-foreground/60 leading-snug">
            {renderSecondary(v)}
          </div>
        )}

        {/* Day chips strip — keeps the at-a-glance day pattern visible */}
        <div className="flex gap-1 pt-1">
          {DAYS.map((d) => {
            const isActive = summary.topDays.includes(d);
            return (
              <span
                key={d}
                className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider transition-colors"
                style={
                  isActive
                    ? { backgroundColor: accentColor, color: "#fff" }
                    : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                }
              >
                {d}
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
