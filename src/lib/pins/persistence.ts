// Saves pins in the Tauri store (settings.json in the app config dir).
// In a plain browser (pnpm dev) it falls back to localStorage.

import { load, type Store } from "@tauri-apps/plugin-store";
import { inTauri } from "$lib/native.ts";
import { sanitizePins } from "./pins.ts";

const SETTINGS_FILE = "settings.json";
const PINS_KEY = "pins";

let storePromise: Promise<Store> | null = null;

function settingsStore(): Promise<Store> {
  storePromise ??= load(SETTINGS_FILE, { autoSave: false, defaults: {} });
  return storePromise;
}

/** Never throws: a missing or corrupt file means "no pins yet". */
export async function loadPins(): Promise<number[]> {
  try {
    if (!inTauri) return sanitizePins(JSON.parse(localStorage.getItem(PINS_KEY) ?? "[]"));
    return sanitizePins(await (await settingsStore()).get<unknown>(PINS_KEY));
  } catch (error) {
    console.error("Could not load pinned cities; starting with none.", error);
    return [];
  }
}

export async function savePins(pins: readonly number[]): Promise<void> {
  if (!inTauri) {
    localStorage.setItem(PINS_KEY, JSON.stringify(pins));
    return;
  }
  const store = await settingsStore();
  await store.set(PINS_KEY, pins);
  await store.save();
}
