import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { decodeCities, type CityDataset } from "./dataset.ts";
import { normalize } from "./normalize.ts";
import { createSearch } from "./search.ts";

const dataset = JSON.parse(
  readFileSync(new URL("../data/cities.json", import.meta.url), "utf8"),
) as CityDataset;
const search = createSearch(decodeCities(dataset));

describe("normalize", () => {
  test.each([
    ["São Paulo", "sao paulo"],
    ["St. Louis", "st louis"],
    ["  New   York ", "new york"],
    ["İstanbul", "istanbul"],
  ])("%s -> %s", (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});

describe("createSearch", () => {
  const names = (query: string, limit?: number) =>
    search(query, limit).map((c) => `${c.name}, ${c.cc}`);

  test("is accent-insensitive", () => {
    expect(names("sao paulo")[0]).toBe("São Paulo, BR");
  });

  test("returns same-named cities, biggest first, with distinct regions", () => {
    const portlands = search("portland").filter((c) => c.name === "Portland");
    expect(portlands.length).toBeGreaterThanOrEqual(2);
    expect(portlands[0].admin1).toBe("Oregon");
    expect(new Set(portlands.map((c) => c.admin1)).size).toBe(portlands.length);
  });

  test("ranks a name prefix above a later-word prefix, regardless of population", () => {
    const results = names("york", 50);
    expect(results.indexOf("York, GB")).toBeGreaterThanOrEqual(0);
    expect(results.indexOf("York, GB")).toBeLessThan(results.indexOf("New York City, US"));
  });

  test("ignores punctuation", () => {
    expect(names("st louis")).toContain("St. Louis, US");
  });

  test("matches names typed without spaces", () => {
    expect(names("hochiminh")[0]).toBe("Ho Chi Minh City, VN");
  });

  test("returns nothing for an empty or blank query", () => {
    expect(search("")).toEqual([]);
    expect(search("   ")).toEqual([]);
  });

  test("respects the result limit", () => {
    expect(search("a")).toHaveLength(20);
    expect(search("a", 5)).toHaveLength(5);
  });

  test("is fast enough to run on every keystroke", () => {
    const queries = ["n", "ne", "new", "new y", "lon", "tok", "zzz", "sao", "st l", "berl"];
    const start = performance.now();
    for (let i = 0; i < 100; i++) queries.forEach((q) => search(q));
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
