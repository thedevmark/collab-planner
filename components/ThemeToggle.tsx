"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type ThemeOption = "system" | "light" | "dark";

interface OptionDef {
  value: ThemeOption;
  label: string;
  short: string;
  Icon: LucideIcon;
}

const OPTIONS: OptionDef[] = [
  { value: "system", label: "Match system", short: "Auto", Icon: Monitor },
  { value: "light", label: "Light mode", short: "Light", Icon: Sun },
  { value: "dark", label: "Dark mode", short: "Dark", Icon: Moon },
];

export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Until next-themes hydrates we don't know the active option, so we
  // render the segmented track without a highlighted pip — keeps the
  // markup stable for hydration and avoids flashing the wrong option.
  const active: ThemeOption = mounted ? ((theme as ThemeOption | undefined) ?? "system") : "system";

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-border bg-muted/80 p-0.5 text-xs font-medium text-muted-foreground",
        compact ? "h-8" : "h-9",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, short, Icon }) => {
        const isActive = mounted && active === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full transition-colors",
              compact ? "h-7 px-2" : "h-8 px-3",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            {!compact ? <span>{short}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
