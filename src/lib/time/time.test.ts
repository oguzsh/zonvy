import { describe, expect, test } from "vitest";
import { dayTag, formatClock, formatOffset } from "./format.ts";
import { isValidZone, offsetMinutes, relativeOffsetMinutes } from "./zone.ts";

const at = (iso: string) => new Date(iso);

describe("offsetMinutes", () => {
  test.each([
    ["Asia/Kathmandu", 345],
    ["Asia/Kolkata", 330],
    ["Australia/Adelaide", 630], // summer (ACDT) in January
    ["Europe/London", 0],
    ["America/St_Johns", -210],
  ])("%s in January -> %i", (tz, expected) => {
    expect(offsetMinutes(at("2026-01-15T12:00:00Z"), tz)).toBe(expected);
  });

  test("follows the US spring-forward transition (2026-03-08 07:00 UTC)", () => {
    expect(offsetMinutes(at("2026-03-08T06:59:00Z"), "America/New_York")).toBe(
      -300,
    );
    expect(offsetMinutes(at("2026-03-08T07:01:00Z"), "America/New_York")).toBe(
      -240,
    );
  });

  test("handles the weeks when the US and UK are out of step", () => {
    const nyMinusLondon = (iso: string) =>
      relativeOffsetMinutes(at(iso), "America/New_York", "Europe/London");
    expect(nyMinusLondon("2026-03-05T12:00:00Z")).toBe(-300);
    expect(nyMinusLondon("2026-03-20T12:00:00Z")).toBe(-240);
  });
});

describe("relativeOffsetMinutes", () => {
  test("depends on the local zone passed in, so travelling updates it", () => {
    const instant = at("2026-11-13T17:42:00Z");
    expect(
      relativeOffsetMinutes(instant, "Asia/Tokyo", "America/Los_Angeles"),
    ).toBe(1020);
    expect(
      relativeOffsetMinutes(instant, "Asia/Tokyo", "Europe/Istanbul"),
    ).toBe(360);
  });
});

describe("formatOffset", () => {
  test.each([
    [180, "+3h"],
    [-330, "−5h30"],
    [345, "+5h45"],
    [0, "±0h"],
    [1020, "+17h"],
    [-30, "−0h30"],
  ])("%i -> %s", (minutes, expected) => {
    expect(formatOffset(minutes)).toBe(expected);
  });
});

describe("dayTag", () => {
  const friday = at("2026-11-13T17:42:00Z"); // 09:42 Fri in Los Angeles

  test("shows the weekday when the city is on another date", () => {
    expect(dayTag(friday, "Asia/Tokyo", "America/Los_Angeles")).toBe("Sat");
  });

  test("is null on the same date", () => {
    expect(dayTag(friday, "Europe/London", "America/Los_Angeles")).toBeNull();
  });
});

describe("formatClock", () => {
  const instant = at("2026-11-13T17:42:00Z");

  test("24h", () => {
    expect(formatClock(instant, "Asia/Tokyo", false)).toBe("02:42");
  });

  test("12h", () => {
    expect(formatClock(instant, "Asia/Tokyo", true)).toBe("2:42 AM");
  });
});

describe("isValidZone", () => {
  test("rejects unknown and empty ids without throwing", () => {
    expect(isValidZone("Mars/Olympus")).toBe(false);
    expect(isValidZone("")).toBe(false);
    expect(isValidZone("Asia/Tokyo")).toBe(true);
  });
});
