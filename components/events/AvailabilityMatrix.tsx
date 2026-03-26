"use client";

import { useCallback, useMemo, useState } from "react";
import { addDays, formatDistanceToNowStrict } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PlannerFriendLike } from "@/lib/scheduling/planner";
import { getPlannerHourlySlots } from "@/lib/scheduling/planner";
import type { ScoredSlot } from "@/lib/scheduling/overlap";

interface AvailabilityMatrixProps {
  friends: PlannerFriendLike[];
  selectedFriendIds: number[];
  timezone: string;
  anchorStart: string;
  selectedStartTime: string;
  durationMs: number;
  onApplySlot: (slot: ScoredSlot) => void;
}

const MATRIX_DAYS = 7;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const READY_THRESHOLD = 0.18;

function formatLocalHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const value = hour % 12 || 12;
  return `${value}${suffix}`;
}

function toneForSlot(slot: ScoredSlot, peakScore: number) {
  const ratio = peakScore > 0 ? slot.combinedScore / peakScore : 0;

  if (slot.viable) {
    return {
      backgroundColor: `rgba(34, 197, 94, ${0.16 + ratio * 0.58})`,
      borderColor: `rgba(34, 197, 94, ${0.2 + ratio * 0.45})`,
      color: ratio >= 0.58 ? "#052e16" : "#14532d",
    };
  }

  return {
    backgroundColor: `rgba(51, 65, 85, ${0.12 + ratio * 0.22})`,
    borderColor: `rgba(100, 116, 139, ${0.16 + ratio * 0.22})`,
    color: "#cbd5e1",
  };
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

export function AvailabilityMatrix({
  friends,
  selectedFriendIds,
  timezone,
  anchorStart,
  selectedStartTime,
  durationMs,
  onApplySlot,
}: AvailabilityMatrixProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const selectedFriends = useMemo(
    () => friends.filter((friend) => selectedFriendIds.includes(friend.id)),
    [friends, selectedFriendIds]
  );

  const datePartsFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    [timezone]
  );
  const dayLabelFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
      }),
    [timezone]
  );
  const dateLabelFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        month: "short",
        day: "numeric",
      }),
    [timezone]
  );
  const hourKeyFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        hourCycle: "h23",
      }),
    [timezone]
  );
  const slotLabelFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    [timezone]
  );
  const timeOnlyFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    [timezone]
  );

  const dateKey = useCallback(
    (date: Date) => {
      const parts = datePartsFormatter.formatToParts(date);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return `${values.year}-${values.month}-${values.day}`;
    },
    [datePartsFormatter]
  );

  const slotKey = useCallback(
    (date: Date) => `${dateKey(date)}-${hourKeyFormatter.format(date)}`,
    [dateKey, hourKeyFormatter]
  );

  const from = useMemo(() => {
    const anchor = anchorStart ? new Date(anchorStart) : new Date();
    if (Number.isNaN(anchor.getTime())) return new Date();
    const dayStart = new Date(anchor);
    dayStart.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return dayStart < now ? now : dayStart;
  }, [anchorStart]);

  const to = useMemo(() => addDays(from, MATRIX_DAYS), [from]);

  const patterns = useMemo(
    () => selectedFriends,
    [selectedFriends]
  );

  const hourlySlots = useMemo(() => getPlannerHourlySlots(patterns, from, to), [patterns, from, to]);

  const columns = useMemo(() => {
    const seen = new Map<string, { key: string; dayLabel: string; dateLabel: string }>();

    for (const slot of hourlySlots) {
      const key = dateKey(slot.start);
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          dayLabel: dayLabelFormatter.format(slot.start),
          dateLabel: dateLabelFormatter.format(slot.start),
        });
      }
    }

    return Array.from(seen.values());
  }, [dateKey, dateLabelFormatter, dayLabelFormatter, hourlySlots]);

  const cellMap = useMemo(() => {
    const map = new Map<string, ScoredSlot>();
    for (const slot of hourlySlots) {
      map.set(slotKey(slot.start), slot);
    }
    return map;
  }, [hourlySlots, slotKey]);

  const peakScore = useMemo(
    () => Math.max(...hourlySlots.map((slot) => slot.combinedScore), 0.001),
    [hourlySlots]
  );

  const bestSlot = useMemo(() => {
    const viable = hourlySlots.filter((slot) => slot.viable);
    const pool = viable.length > 0 ? viable : hourlySlots;
    return [...pool].sort(
      (left, right) => right.combinedScore - left.combinedScore || left.start.getTime() - right.start.getTime()
    )[0];
  }, [hourlySlots]);

  const selectedKey = useMemo(() => {
    if (!selectedStartTime) return null;
    const selected = new Date(selectedStartTime);
    if (Number.isNaN(selected.getTime())) return null;
    selected.setMinutes(0, 0, 0);
    return slotKey(selected);
  }, [selectedStartTime, slotKey]);

  const activeSlot = hoveredKey
    ? cellMap.get(hoveredKey) ?? bestSlot
    : (selectedKey ? cellMap.get(selectedKey) : undefined) ?? bestSlot;

  const scheduledFriends = useMemo(() => {
    if (!activeSlot) return [];

    return selectedFriends.filter((friend) =>
      (friend.scheduleSegments ?? []).some((segment) =>
        overlaps(
          activeSlot.start,
          activeSlot.end,
          new Date(segment.startTime),
          new Date(segment.endTime)
        )
      )
    );
  }, [activeSlot, selectedFriends]);

  if (selectedFriends.length === 0 || columns.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Workable Windows</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Inspired by availability-grid scheduling tools: pick your people, scan the week, click a block to lock a start time.
            </p>
          </div>
          <Badge variant="outline" className="shrink-0">
            {timezone}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Darker blocks are stronger fits for the selected group.</span>
          <span>Grid shows the next {MATRIX_DAYS} days.</span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `72px repeat(${columns.length}, minmax(0, 1fr))` }}
            >
              <div />
              {columns.map((column) => (
                <div key={column.key} className="px-1 pb-2 text-center">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{column.dayLabel}</div>
                  <div className="text-sm font-semibold">{column.dateLabel}</div>
                </div>
              ))}

              {HOURS.map((hour) => (
                <FragmentRow
                  key={hour}
                  hour={hour}
                  columns={columns}
                  cellMap={cellMap}
                  activeKey={hoveredKey ?? selectedKey ?? (bestSlot ? slotKey(bestSlot.start) : null)}
                  peakScore={peakScore}
                  setHoveredKey={setHoveredKey}
                  onApplySlot={onApplySlot}
                />
              ))}
            </div>
          </div>
        </div>

        {activeSlot && (
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={activeSlot.viable ? "success" : "secondary"}>
                {activeSlot.viable ? "Good Fit" : "Possible"}
              </Badge>
              <span className="text-sm font-medium">
                {slotLabelFormatter.format(activeSlot.start)} to{" "}
                {timeOnlyFormatter.format(new Date(activeSlot.start.getTime() + durationMs))}
              </span>
              <span className="text-xs text-muted-foreground">
                {Math.round(activeSlot.combinedScore * 100)}% group fit
              </span>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              {scheduledFriends.length > 0
                ? `Posted schedule overlap: ${scheduledFriends
                    .map((friend) => (friend.isMe ? "You" : friend.displayName))
                    .join(", ")}.`
                : "No posted schedule overlaps here; this block is inferred from stream patterns."}
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[...activeSlot.friendScores]
                .sort((left, right) => right.score - left.score)
                .map((friendScore) => {
                  const friend = selectedFriends.find((entry) => entry.id === friendScore.friendId);
                  const label = friend?.isMe ? "You" : friend?.displayName ?? friendScore.displayName;
                  const chance = Math.round(friendScore.score * 100);
                  return (
                    <div key={friendScore.friendId} className="rounded-md border bg-background/60 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium">{label}</span>
                        <span className="text-muted-foreground">{chance}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${chance}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Best current block: {bestSlot ? formatDistanceToNowStrict(bestSlot.start, { addSuffix: true }) : "none yet"}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FragmentRowProps {
  hour: number;
  columns: Array<{ key: string; dayLabel: string; dateLabel: string }>;
  cellMap: Map<string, ScoredSlot>;
  activeKey: string | null | undefined;
  peakScore: number;
  setHoveredKey: (key: string | null) => void;
  onApplySlot: (slot: ScoredSlot) => void;
}

function FragmentRow({
  hour,
  columns,
  cellMap,
  activeKey,
  peakScore,
  setHoveredKey,
  onApplySlot,
}: FragmentRowProps) {
  return (
    <>
      <div className="flex items-start justify-end pr-3 pt-1.5 text-xs text-muted-foreground">
        {formatLocalHour(hour)}
      </div>
      {columns.map((column) => {
        const key = `${column.key}-${String(hour).padStart(2, "0")}`;
        const slot = cellMap.get(key);

        if (!slot) {
          return <div key={key} className="h-7 rounded-md border border-transparent bg-muted/20" />;
        }

        const isActive = activeKey === key;
        const readyCount = slot.friendScores.filter((friend) => friend.score >= READY_THRESHOLD).length;
        const tone = toneForSlot(slot, peakScore);

        return (
          <button
            key={key}
            type="button"
            onMouseEnter={() => setHoveredKey(key)}
            onMouseLeave={() => setHoveredKey(null)}
            onFocus={() => setHoveredKey(key)}
            onBlur={() => setHoveredKey(null)}
            onClick={() => onApplySlot(slot)}
            aria-label={`${column.dayLabel} ${column.dateLabel} at ${formatLocalHour(hour)}. ${Math.round(
              slot.combinedScore * 100
            )}% group fit.`}
            className="relative h-7 rounded-md border text-[10px] font-medium transition-all hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            style={{
              ...tone,
              boxShadow: isActive ? "inset 0 0 0 1px rgba(255,255,255,0.7)" : undefined,
            }}
          >
            <span className="absolute right-1 top-1 leading-none">
              {readyCount}/{slot.friendScores.length}
            </span>
          </button>
        );
      })}
    </>
  );
}
