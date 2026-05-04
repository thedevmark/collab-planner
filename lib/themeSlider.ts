"use client";

import { useEffect, useState } from "react";

/**
 * Continuous dark↔light slider.
 *
 * Each theme token is a pair of HSL endpoints. The slider value `t` in
 * [0, 1] linearly interpolates each component (H, S, L) and writes the
 * resulting `H S% L%` string to the matching `--token` CSS variable on
 * documentElement. No discrete "light/dark" mode — the whole spectrum is
 * available so the user can dial in a comfortable midpoint instead of
 * being stuck on a harsh white-on-black or black-on-white extreme.
 *
 * Tokens mirror the dark / .light blocks in app/globals.css.
 *
 * Boot order, to avoid first-paint flash:
 *   1. Inline boot script in app/layout.tsx runs synchronously before
 *      React hydrates and applies the saved value (or the system
 *      preference fallback) to documentElement.
 *   2. useThemeSlider() reads the same value on mount, exposes a setter,
 *      and re-applies on change.
 */

export const STORAGE_KEY = "collab-theme-t";
export const CHANGE_EVENT = "collab-theme-change";

type Triplet = readonly [number, number, number];

interface TokenPair {
  name: string;
  dark: Triplet;
  light: Triplet;
}

// Order matches app/globals.css. Keep both lists in sync if either is
// edited — the boot script and runtime hook both consume this array.
export const TOKEN_PAIRS: TokenPair[] = [
  { name: "--background", dark: [240, 10, 3.9], light: [240, 20, 97] },
  { name: "--foreground", dark: [0, 0, 98], light: [240, 6, 12] },
  { name: "--card", dark: [240, 6, 6], light: [0, 0, 100] },
  { name: "--card-foreground", dark: [0, 0, 98], light: [240, 6, 12] },
  { name: "--popover", dark: [240, 6, 6], light: [0, 0, 100] },
  { name: "--popover-foreground", dark: [0, 0, 98], light: [240, 6, 12] },
  { name: "--primary", dark: [221, 83, 73], light: [221, 83, 53] },
  { name: "--primary-foreground", dark: [240, 10, 4], light: [0, 0, 100] },
  { name: "--secondary", dark: [240, 4, 11], light: [240, 14, 94] },
  { name: "--secondary-foreground", dark: [0, 0, 98], light: [240, 6, 12] },
  { name: "--muted", dark: [240, 4, 11], light: [240, 14, 94] },
  { name: "--muted-foreground", dark: [240, 4, 65], light: [240, 4, 42] },
  { name: "--accent", dark: [240, 4, 15], light: [240, 12, 91] },
  { name: "--accent-foreground", dark: [0, 0, 98], light: [240, 6, 12] },
  { name: "--destructive", dark: [0, 63, 31], light: [0, 72, 51] },
  { name: "--destructive-foreground", dark: [0, 0, 98], light: [0, 0, 100] },
  { name: "--border", dark: [240, 4, 16], light: [240, 8, 84] },
  { name: "--input", dark: [240, 4, 16], light: [240, 8, 84] },
  { name: "--ring", dark: [221, 83, 73], light: [221, 83, 53] },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Apply the interpolated token set to documentElement.style. */
export function applyThemeSlider(t: number): void {
  if (typeof document === "undefined") return;
  const c = clamp01(t);
  const root = document.documentElement;
  for (const { name, dark, light } of TOKEN_PAIRS) {
    const h = lerp(dark[0], light[0], c);
    const s = lerp(dark[1], light[1], c);
    const l = lerp(dark[2], light[2], c);
    // Globals.css consumes raw `H S% L%` triples through hsl(var(--foo)).
    root.style.setProperty(name, `${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%`);
  }
  // Hint to native form controls and scrollbars.
  root.style.colorScheme = c < 0.5 ? "dark" : "light";
}

/** Resolve the value to use on first paint (no localStorage entry yet). */
export function defaultThemeSlider(): number {
  if (typeof window === "undefined") return 0;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const n = Number(saved);
      if (Number.isFinite(n)) return clamp01(n);
    }
  } catch {
    // private mode, etc — fall through to system preference
  }
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return 1;
  }
  return 0;
}

/**
 * React hook: returns [t, setT]. Reads from localStorage on mount,
 * persists writes, applies tokens, and broadcasts a custom event so
 * multiple instances (sidebar + settings page) stay in sync.
 */
export function useThemeSlider(): readonly [number, (next: number) => void] {
  // SSR + first paint use the same default the boot script applies, so
  // hydration markup matches whatever the script wrote to documentElement.
  const [t, setT] = useState<number>(0);

  useEffect(() => {
    setT(defaultThemeSlider());

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      if (typeof detail === "number") setT(clamp01(detail));
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  function update(next: number) {
    const c = clamp01(next);
    setT(c);
    applyThemeSlider(c);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(c));
    } catch {
      /* ignore quota / private-mode errors */
    }
    window.dispatchEvent(new CustomEvent<number>(CHANGE_EVENT, { detail: c }));
  }

  return [t, update] as const;
}
