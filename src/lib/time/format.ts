// Display formatting for times, offsets and day tags.

const MINUS = "−"; // typographic minus, not a hyphen

/** 180 -> "+3h", -330 -> "−5h30", 345 -> "+5h45", 0 -> "±0h". */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return "±0h";
  const sign = minutes > 0 ? "+" : MINUS;
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `${sign}${hours}h${rest === 0 ? "" : String(rest).padStart(2, "0")}`;
}

const NO_BREAK_SPACE = " ";

/**
 * "02:42" (24h) or "2:42 AM" (12h) for `instant` in `tz`. ICU versions disagree on
 * the space before AM/PM (plain vs narrow no-break), so it's normalized to one that
 * looks the same everywhere and never wraps.
 */
export function formatClock(
  instant: Date,
  tz: string,
  hour12: boolean,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: hour12 ? "numeric" : "2-digit",
    minute: "2-digit",
    hourCycle: hour12 ? "h12" : "h23",
  })
    .format(instant)
    .replace(/[\s ]+/gu, NO_BREAK_SPACE);
}

/** Short weekday ("Sat") when the city's calendar date differs from the user's, else null. */
export function dayTag(
  instant: Date,
  cityTz: string,
  localTz: string,
): string | null {
  if (calendarDate(instant, cityTz) === calendarDate(instant, localTz))
    return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: cityTz,
    weekday: "short",
  }).format(instant);
}

/** "2026-11-13" in the given zone ("en-CA" formats dates as YYYY-MM-DD). */
function calendarDate(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
