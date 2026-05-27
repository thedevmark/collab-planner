export interface FormatOptions {
  locale: string;
  timeZone: string;
}

/** "7 PM" / "7:30 PM" / "19:00" / "19:30" depending on minute + use24.
 *  Default minute is 0 so existing call sites that don't care about :30
 *  precision render unchanged. */
export function formatHour(hour: number, use24: boolean, minute: 0 | 30 = 0): string {
  const hr = ((hour % 24) + 24) % 24;
  const mm = minute === 30 ? "30" : "00";
  if (use24) return `${hr.toString().padStart(2, "0")}:${mm}`;
  const h12 = hr % 12 || 12;
  const ampm = hr >= 12 ? "PM" : "AM";
  if (minute === 0) return `${h12} ${ampm}`;
  return `${h12}:${mm} ${ampm}`;
}

/** "7pm" / "7:30pm" / "19" / "19:30" depending on use24 + minute.
 *  Default minute 0 keeps axis ticks hour-aligned ("4pm", not "4:00pm"). */
export function formatHourCompact(hour: number, use24: boolean, minute: 0 | 30 = 0): string {
  const hr = ((hour % 24) + 24) % 24;
  if (use24) return minute === 30 ? `${hr}:30` : hr.toString();
  const h12 = hr % 12 || 12;
  const mm = minute === 30 ? ":30" : "";
  return `${h12}${mm}${hr >= 12 ? "pm" : "am"}`;
}

export interface FormattedSlot {
  day: string;
  time: string;
}

export function formatSlot(startsAt: string, opts: FormatOptions): FormattedSlot {
  const d = new Date(startsAt);
  const dayFmt = new Intl.DateTimeFormat(opts.locale, {
    weekday: "short",
    timeZone: opts.timeZone,
  });
  const timeFmt = new Intl.DateTimeFormat(opts.locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: opts.timeZone,
  });
  return {
    day: dayFmt.format(d),
    time: timeFmt.format(d),
  };
}

export function resolveViewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function resolveViewerLocale(twitchLocale: string | undefined): string {
  if (twitchLocale) return twitchLocale;
  if (typeof navigator !== "undefined" && navigator.language) return navigator.language;
  return "en-US";
}
