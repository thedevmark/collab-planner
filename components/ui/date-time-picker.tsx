"use client";

import { useState, useRef, useEffect } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, isSameDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toLocalValue(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

interface Props {
  value: string; // "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
}

export function DateTimePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = value ? new Date(value) : null;
  const [viewDate, setViewDate] = useState(() => selected ?? new Date());

  // hour/minute state for the time row
  const rawHour = selected ? selected.getHours() : 20;
  const rawMinute = selected ? Math.round(selected.getMinutes() / 15) * 15 % 60 : 0;
  const displayHour = rawHour % 12 === 0 ? 12 : rawHour % 12;
  const isPM = rawHour >= 12;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pickDay(day: Date) {
    const next = new Date(day);
    next.setHours(rawHour, rawMinute, 0, 0);
    onChange(toLocalValue(next));
  }

  function setTime(h24: number, min: number) {
    const base = selected ? new Date(selected) : new Date();
    base.setHours(h24, min, 0, 0);
    onChange(toLocalValue(base));
  }

  function onHourChange(raw: string) {
    let h = parseInt(raw);
    if (isNaN(h)) return;
    h = Math.max(1, Math.min(12, h));
    const h24 = isPM ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
    setTime(h24, rawMinute);
  }

  function onMinuteChange(raw: string) {
    let m = parseInt(raw);
    if (isNaN(m)) return;
    m = Math.max(0, Math.min(59, m));
    setTime(rawHour, m);
  }

  function toggleAmPm() {
    const h24 = isPM
      ? (rawHour === 12 ? 0 : rawHour - 12)
      : (rawHour === 0 ? 12 : rawHour + 12);
    setTime(h24, rawMinute);
  }

  const monthStart = startOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(viewDate) });
  const offset = getDay(monthStart);

  const label = selected
    ? format(selected, "EEE, MMM d · h:mm a")
    : "Pick date & time";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm text-left hover:bg-accent transition-colors"
      >
        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {label}
        </span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-68 rounded-lg border border-border bg-card shadow-2xl">
          {/* Month nav */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <button
              type="button"
              onClick={() => setViewDate(subMonths(viewDate, 1))}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">{format(viewDate, "MMMM yyyy")}</span>
            <button
              type="button"
              onClick={() => setViewDate(addMonths(viewDate, 1))}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {DAY_HEADERS.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground pb-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 px-2 pb-2 gap-y-0.5">
            {Array.from({ length: offset }).map((_, i) => <div key={i} />)}
            {days.map((day) => {
              const sel = selected && isSameDay(day, selected);
              const today = isSameDay(day, new Date());
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => pickDay(day)}
                  className={cn(
                    "h-7 w-7 mx-auto flex items-center justify-center rounded-md text-xs font-medium transition-colors",
                    sel && "bg-primary text-primary-foreground",
                    !sel && today && "bg-zinc-800 text-zinc-100",
                    !sel && !today && "hover:bg-accent text-foreground"
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          {/* Time row */}
          <div className="border-t border-border px-3 py-2.5 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select
              value={displayHour}
              onChange={(e) => onHourChange(e.target.value)}
              className="h-7 px-1 text-sm rounded border border-input bg-background text-foreground"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
              ))}
            </select>
            <span className="text-muted-foreground font-medium">:</span>
            <select
              value={rawMinute}
              onChange={(e) => onMinuteChange(e.target.value)}
              className="h-7 px-1 text-sm rounded border border-input bg-background text-foreground"
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
              ))}
            </select>
            <select
              value={isPM ? "PM" : "AM"}
              onChange={(e) => { if ((e.target.value === "PM") !== isPM) toggleAmPm(); }}
              className="h-7 px-1 text-sm rounded border border-input bg-background text-foreground"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-50 px-3 py-1 rounded transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
