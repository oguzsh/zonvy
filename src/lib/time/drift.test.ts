// Linux only: WebKitGTK's Intl uses ICU's bundled zone data, which can lag the distro's
// tzdata. This compares ICU with the system tzdata for major zones and names any zone
// that disagrees. Caveat: it runs in Node, whose ICU copy stands in for WebKitGTK's
// (same library, possibly a different release), so it's an early warning, not proof.

import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import { offsetMinutes } from "./zone.ts";

const ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/** Offset in minutes from the system tzdata, via GNU date: "+0545" -> 345. */
function systemOffsetMinutes(instant: Date, tz: string): number {
  const epoch = Math.floor(instant.getTime() / 1000);
  const out = execFileSync("date", ["-d", `@${epoch}`, "+%z"], {
    env: { TZ: tz },
  })
    .toString()
    .trim();
  const sign = out.startsWith("-") ? -1 : 1;
  return sign * (Number(out.slice(1, 3)) * 60 + Number(out.slice(3, 5)));
}

describe.runIf(process.platform === "linux")("ICU vs system tzdata", () => {
  const instants = [
    new Date("2026-01-15T12:00:00Z"),
    new Date("2026-07-15T12:00:00Z"),
  ];

  test.each(ZONES)("%s agrees", (tz) => {
    for (const instant of instants) {
      expect(
        offsetMinutes(instant, tz),
        `${tz} at ${instant.toISOString()}`,
      ).toBe(systemOffsetMinutes(instant, tz));
    }
  });
});
