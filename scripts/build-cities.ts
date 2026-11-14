// Dev-time only: turns raw GeoNames dumps into the bundled city dataset.
// Usage: download cities15000.txt and admin1CodesASCII.txt into scripts/raw/, then `pnpm data`.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { City } from "../src/lib/cities/types.ts";
import { encodeCities } from "../src/lib/cities/dataset.ts";
import { parseAdmin1, parseCityLine } from "./geonames.ts";

const MAX_SIZE_MB = 2;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = join(ROOT, "scripts", "raw");
const CITIES_FILE = join(RAW_DIR, "cities15000.txt");
const ADMIN1_FILE = join(RAW_DIR, "admin1CodesASCII.txt");
const OUTPUT_FILE = join(ROOT, "src", "lib", "data", "cities.json");

function readRaw(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(
      `Missing ${path}. Download it from https://download.geonames.org/export/dump/ into scripts/raw/.`,
      { cause: error },
    );
  }
}

function buildCities(
  citiesText: string,
  admin1: ReadonlyMap<string, string>,
): City[] {
  const lines = citiesText.split("\n").filter((line) => line.trim() !== "");
  const cities = lines
    .map((line) => parseCityLine(line, admin1))
    .filter((city): city is City => city !== null);

  const skipped = lines.length - cities.length;
  if (skipped > 0) console.warn(`Skipped ${skipped} malformed line(s).`);

  return cities.toSorted((a, b) => b.pop - a.pop);
}

function main(): void {
  const admin1 = parseAdmin1(readRaw(ADMIN1_FILE));
  const cities = buildCities(readRaw(CITIES_FILE), admin1);

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  const json = JSON.stringify(encodeCities(cities));
  writeFileSync(OUTPUT_FILE, json + "\n");

  const sizeMb = Buffer.byteLength(json) / 1024 / 1024;
  console.log(
    `Wrote ${cities.length} cities (${sizeMb.toFixed(2)} MB) to ${OUTPUT_FILE}`,
  );
  if (sizeMb > MAX_SIZE_MB) {
    console.error(`Dataset exceeds the ${MAX_SIZE_MB} MB budget.`);
    process.exitCode = 1;
  }
}

main();
