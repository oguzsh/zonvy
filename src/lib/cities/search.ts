import { normalize } from "./normalize.ts";
import type { City } from "./types.ts";

export const DEFAULT_RESULT_LIMIT = 20;

/** Match quality, best first. (A plain object, not an enum, so Node can run this file directly.) */
const Rank = { Prefix: 0, WordPrefix: 1, Substring: 2, None: 3 } as const;
type Rank = (typeof Rank)[keyof typeof Rank];

/** Separates name variants inside one haystack; never appears in normalized text. */
const SEP = "\n";

type IndexedCity = {
  readonly city: City;
  /** Normalized name variants (display + ASCII), each preceded by SEP: "\nsao paulo". */
  readonly haystack: string;
  /** Same variants with spaces removed, so "hochiminh" finds "Ho Chi Minh City". */
  readonly compactHaystack: string;
};

export type CitySearch = (query: string, limit?: number) => City[];

/** Builds a search function over a fixed city list. Normalization happens once, here. */
export function createSearch(cities: readonly City[]): CitySearch {
  const index = cities.toSorted((a, b) => b.pop - a.pop).map(indexCity);

  return (query, limit = DEFAULT_RESULT_LIMIT) => {
    const q = normalize(query);
    if (q === "" || limit <= 0) return [];
    return rankedMatches(index, q, limit);
  };
}

function indexCity(city: City): IndexedCity {
  const variants = [...new Set([normalize(city.name), normalize(city.ascii)])];
  return {
    city,
    haystack: variants.map((v) => SEP + v).join(""),
    compactHaystack: variants.map((v) => SEP + removeSpaces(v)).join(""),
  };
}

/**
 * The index is sorted by population, so filling one bucket per rank in index
 * order gives "best rank first, then biggest city first" without a final sort.
 */
function rankedMatches(index: readonly IndexedCity[], q: string, limit: number): City[] {
  const qCompact = removeSpaces(q);
  const buckets: City[][] = [[], [], []];

  for (const entry of index) {
    const rank = rankOf(entry, q, qCompact);
    if (rank !== Rank.None) buckets[rank].push(entry.city);
    if (buckets[Rank.Prefix].length >= limit) break;
  }
  return buckets.flat().slice(0, limit);
}

function rankOf({ haystack, compactHaystack }: IndexedCity, q: string, qCompact: string): Rank {
  // Cheap rejection first: most cities don't contain the query at all.
  const inName = haystack.includes(q);
  if (!inName && !compactHaystack.includes(qCompact)) return Rank.None;

  if (haystack.includes(SEP + q) || compactHaystack.includes(SEP + qCompact)) return Rank.Prefix;
  if (haystack.includes(" " + q)) return Rank.WordPrefix;
  return Rank.Substring;
}

function removeSpaces(s: string): string {
  return s.replaceAll(" ", "");
}
