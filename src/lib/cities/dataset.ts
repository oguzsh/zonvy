// Compact on-disk format for the bundled city dataset, and its decoder.
// Repeated strings (time zones, region names) are stored once in lookup tables,
// and each city is a tuple instead of an object, which roughly halves the file.

import type { City } from "./types.ts";

/** [id, name, ascii (or 0 when equal to name), cc, admin1 index, population, tz index] */
export type CityTuple = [number, string, string | 0, string, number, number, number];

export type CityDataset = {
  readonly version: 1;
  readonly tz: readonly string[];
  readonly admin1: readonly string[];
  readonly cities: readonly CityTuple[];
};

/** Builds the compact dataset. Used by the dev-time build script. */
export function encodeCities(cities: readonly City[]): CityDataset {
  const tz = uniqueSorted(cities.map((c) => c.tz));
  const admin1 = uniqueSorted(cities.map((c) => c.admin1));
  const tzIndex = indexOf(tz);
  const admin1Index = indexOf(admin1);

  return {
    version: 1,
    tz,
    admin1,
    cities: cities.map((c): CityTuple => [
      c.id,
      c.name,
      c.ascii === c.name ? 0 : c.ascii,
      c.cc,
      admin1Index.get(c.admin1) ?? 0,
      c.pop,
      tzIndex.get(c.tz) ?? 0,
    ]),
  };
}

/** Expands the compact dataset into City objects. Used by the app at startup. */
export function decodeCities(data: CityDataset): City[] {
  if (data.version !== 1) throw new Error(`Unsupported city dataset version: ${data.version}`);
  return data.cities.map(([id, name, ascii, cc, admin1Idx, pop, tzIdx]) => ({
    id,
    name,
    ascii: ascii === 0 ? name : ascii,
    cc,
    admin1: data.admin1[admin1Idx] ?? "",
    pop,
    tz: data.tz[tzIdx] ?? "",
  }));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].toSorted();
}

function indexOf(values: readonly string[]): Map<string, number> {
  return new Map(values.map((value, i) => [value, i]));
}
