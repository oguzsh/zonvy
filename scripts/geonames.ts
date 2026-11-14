// Pure parsers for GeoNames dump files. No file I/O here.
// Format reference: https://download.geonames.org/export/dump/readme.txt

import type { City } from "../src/lib/cities/types.ts";

/** Column positions in cities15000.txt (tab-separated, 19 columns). */
const CITY_COLUMNS = {
  id: 0,
  name: 1,
  ascii: 2,
  countryCode: 8,
  admin1Code: 10,
  population: 14,
  timezone: 17,
} as const;

const CITY_COLUMN_COUNT = 19;

/** Parses admin1CodesASCII.txt into a map of "US.OR" -> "Oregon". */
export function parseAdmin1(text: string): Map<string, string> {
  const entries = text
    .split("\n")
    .map((line) => line.split("\t"))
    .filter((cols) => cols.length >= 2 && cols[0] !== "" && cols[1] !== "")
    .map((cols): [string, string] => [cols[0], cols[1]]);
  return new Map(entries);
}

/** Parses one line of cities15000.txt. Returns null for malformed lines. */
export function parseCityLine(line: string, admin1: ReadonlyMap<string, string>): City | null {
  const cols = line.split("\t");
  if (cols.length !== CITY_COLUMN_COUNT) return null;

  const id = Number(cols[CITY_COLUMNS.id]);
  const pop = Number(cols[CITY_COLUMNS.population]);
  const name = cols[CITY_COLUMNS.name];
  const cc = cols[CITY_COLUMNS.countryCode];
  const tz = cols[CITY_COLUMNS.timezone];
  if (!Number.isInteger(id) || !Number.isFinite(pop) || !name || !cc || !tz) return null;

  const admin1Key = `${cc}.${cols[CITY_COLUMNS.admin1Code]}`;
  return {
    id,
    name,
    ascii: cols[CITY_COLUMNS.ascii] || name,
    cc,
    admin1: admin1.get(admin1Key) ?? "",
    pop,
    tz,
  };
}
