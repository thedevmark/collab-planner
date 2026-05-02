"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLight = mounted && resolvedTheme === "light";
  const nextTheme = isLight ? "dark" : "light";

  return (
    <button
      aria-label={`Switch to ${nextTheme} mode`}
      aria-checked={isLight}
      className={cn(
        "group inline-flex shrink-0 items-center rounded-full border border-border bg-muted/80 p-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        compact ? "h-8 w-14" : "h-9 w-full gap-2 px-2",
        className
      )}
      onClick={() => setTheme(nextTheme)}
      role="switch"
      type="button"
    >
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full bg-background text-foreground shadow-sm transition-transform",
          compact && isLight && "translate-x-6"
        )}
      >
        {isLight ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      </span>
      {!compact && (
        <span className="min-w-0 truncate">
          {isLight ? "Light mode" : "Dark mode"}
        </span>
      )}
    </button>
  );
}
