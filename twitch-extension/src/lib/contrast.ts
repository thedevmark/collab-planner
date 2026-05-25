// twitch-extension/src/lib/contrast.ts
//
// Pick black or white text to put on top of a hex background, per WCAG
// relative luminance. Returns "#000000" or "#FFFFFF".
export function pickTextColor(hex: string): "#000000" | "#FFFFFF" {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return "#FFFFFF";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  // Threshold ~0.179 — per WCAG 2.1, this picks the color that yields
  // at least 4.5:1 contrast against the accent background.
  return L > 0.179 ? "#000000" : "#FFFFFF";
}
