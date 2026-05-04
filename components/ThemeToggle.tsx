"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeSlider } from "@/lib/themeSlider";

/**
 * Continuous dark↔light slider. Replaces the old 3-option toggle so the
 * user can dial in a comfortable middle instead of being stuck at the
 * harsh endpoints. Keeps the `compact` API so existing call sites
 * (AppShell topbar, Sidebar footer, Settings page) just keep working.
 */
export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [t, setT] = useThemeSlider();
  const pct = Math.round(t * 100);

  return (
    <label
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-border bg-muted/60 text-muted-foreground",
        compact ? "h-6 gap-1 px-2" : "h-8 gap-2 px-3",
        className,
      )}
      title={`Theme: ${pct}% light`}
    >
      <Moon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
      <span className="sr-only">Theme</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        onChange={(e) => setT(Number(e.target.value) / 100)}
        aria-label={`Theme lightness, ${pct} percent toward light`}
        className={cn(
          "cursor-pointer appearance-none bg-transparent",
          // Track: thin pill with a dark→light gradient so the slider
          // visually previews what each position represents.
          "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full",
          "[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,hsl(240,10%,6%),hsl(240,15%,95%))]",
          "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full",
          "[&::-moz-range-track]:bg-[linear-gradient(to_right,hsl(240,10%,6%),hsl(240,15%,95%))]",
          // Thumb
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:-mt-[3px]",
          "[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-border [&::-moz-range-thumb]:shadow-sm",
          compact ? "w-16" : "w-28",
        )}
      />
      <Sun className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
    </label>
  );
}
