// A reactive "now" that ticks on each minute boundary, plus the user's current zone.

import { currentLocalZone } from "./time/zone.ts";

const MINUTE_MS = 60_000;
/** Fire slightly after the boundary so the new minute is always visible. */
const TICK_SLACK_MS = 50;

export type Clock = {
  readonly now: Date;
  readonly localTz: string;
  /**
   * Re-reads the time now (call when the popover opens; timers pause during sleep).
   * Pass the system zone read from Rust to remember it for later ticks; pass nothing
   * to keep the last one. Without one, the webview's own zone is used.
   */
  refresh(systemTz?: string | null): void;
  stop(): void;
};

export function createClock(): Clock {
  let now = $state(new Date());
  let localTz = $state(currentLocalZone());
  let systemTz: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedule(): void {
    clearTimeout(timer);
    const untilNextMinute = MINUTE_MS - (Date.now() % MINUTE_MS) + TICK_SLACK_MS;
    timer = setTimeout(() => refresh(), untilNextMinute);
  }

  function refresh(tz?: string | null): void {
    if (tz !== undefined) systemTz = tz;
    now = new Date();
    localTz = systemTz || currentLocalZone();
    schedule();
  }

  schedule();

  return {
    get now() {
      return now;
    },
    get localTz() {
      return localTz;
    },
    refresh,
    stop: () => clearTimeout(timer),
  };
}
