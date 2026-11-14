// Pure pin-list operations. Every function returns a new array; inputs are never mutated.

import type { City } from "$lib/cities/types.ts";

export type PinList = readonly number[];

/** Appends `id`; returns the same contents if it's already pinned. */
export function addPin(pins: PinList, id: number): number[] {
  return pins.includes(id) ? [...pins] : [...pins, id];
}

export function removePin(pins: PinList, id: number): number[] {
  return pins.filter((pinned) => pinned !== id);
}

/** Moves the pin at index `from` to index `to`. Out-of-range indexes return a copy. */
export function movePin(pins: PinList, from: number, to: number): number[] {
  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < pins.length;
  if (!inRange(from) || !inRange(to) || from === to) return [...pins];
  const without = pins.filter((_, i) => i !== from);
  return [...without.slice(0, to), pins[from], ...without.slice(to)];
}

/** Pinned cities in pin order. Ids missing from the dataset (e.g. after a data refresh) are dropped. */
export function resolvePins(pins: PinList, byId: ReadonlyMap<number, City>): City[] {
  return pins.flatMap((id) => {
    const city = byId.get(id);
    return city ? [city] : [];
  });
}

/** Turns whatever was stored on disk into a clean pin list: unique positive integers only. */
export function sanitizePins(stored: unknown): number[] {
  if (!Array.isArray(stored)) return [];
  const ids = stored.filter((v): v is number => Number.isInteger(v) && v > 0);
  return [...new Set(ids)];
}
