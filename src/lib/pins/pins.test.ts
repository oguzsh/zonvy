import { describe, expect, test } from "vitest";
import type { City } from "$lib/cities/types.ts";
import { addPin, movePin, removePin, resolvePins, sanitizePins } from "./pins.ts";

const city = (id: number): City => ({
  id,
  name: `City ${id}`,
  ascii: `City ${id}`,
  cc: "XX",
  admin1: "",
  pop: 1,
  tz: "UTC",
});

describe("pins", () => {
  test("addPin appends without duplicates and without mutating", () => {
    const original = [1];
    expect(addPin(original, 3)).toEqual([1, 3]);
    expect(addPin([1, 2], 2)).toEqual([1, 2]);
    expect(original).toEqual([1]);
  });

  test("removePin", () => {
    expect(removePin([1, 2, 3], 2)).toEqual([1, 3]);
  });

  test("movePin", () => {
    expect(movePin([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(movePin([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(movePin([1, 2, 3], 0, 9)).toEqual([1, 2, 3]);
  });

  test("resolvePins drops ids that are no longer in the dataset", () => {
    const byId = new Map([[1, city(1)]]);
    expect(resolvePins([1, 999], byId).map((c) => c.id)).toEqual([1]);
  });

  test.each([
    [undefined, []],
    ["not an array", []],
    [[3, 3, "x", -1, 1.5, 7], [3, 7]],
  ])("sanitizePins(%j) -> %j", (stored, expected) => {
    expect(sanitizePins(stored)).toEqual(expected);
  });
});
