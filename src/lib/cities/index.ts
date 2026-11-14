// The app's single entry point to city data: decoded once, indexed once.

import rawDataset from "$lib/data/cities.json";
import { decodeCities, type CityDataset } from "./dataset.ts";
import { createSearch } from "./search.ts";
import type { City } from "./types.ts";

export type { City } from "./types.ts";

export const cities: readonly City[] = decodeCities(rawDataset as unknown as CityDataset);
export const citiesById: ReadonlyMap<number, City> = new Map(cities.map((c) => [c.id, c]));
export const searchCities = createSearch(cities);
