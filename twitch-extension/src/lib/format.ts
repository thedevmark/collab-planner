export interface FormatOptions {
  locale: string;
  timeZone: string;
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
