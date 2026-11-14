// Time zone math on top of Intl, which uses the OS/webview IANA database.
// Never add hours to a Date by hand: offsets change with DST and history.

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(tz: string): Intl.DateTimeFormat {
  const cached = offsetFormatters.get(tz);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" });
  offsetFormatters.set(tz, formatter);
  return formatter;
}

/** True when the runtime's time zone database knows this IANA id. */
export function isValidZone(tz: string): boolean {
  if (tz === "") return false;
  try {
    offsetFormatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** The zone the user's computer is in right now. Re-read it every time; people travel. */
export function currentLocalZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Minutes east of UTC for `tz` at `instant`, e.g. Asia/Kathmandu -> 345. */
export function offsetMinutes(instant: Date, tz: string): number {
  const name = offsetFormatter(tz)
    .formatToParts(instant)
    .find((part) => part.type === "timeZoneName")?.value;
  return parseGmtOffset(name ?? "GMT");
}

/** How far ahead of the user's zone the city is, in minutes (negative = behind). */
export function relativeOffsetMinutes(instant: Date, cityTz: string, localTz: string): number {
  return offsetMinutes(instant, cityTz) - offsetMinutes(instant, localTz);
}

/** Parses Intl's longOffset label: "GMT" -> 0, "GMT+05:45" -> 345, "GMT-03:30" -> -210. */
function parseGmtOffset(label: string): number {
  const match = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(label.replace("−", "-"));
  if (!match) throw new Error(`Unrecognized time zone offset label: ${label}`);
  const [, sign, hours, minutes] = match;
  if (!sign) return 0;
  const total = Number(hours) * 60 + Number(minutes ?? 0);
  return sign === "-" ? -total : total;
}
