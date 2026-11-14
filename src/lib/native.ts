// Thin, typed wrappers around the Rust side. Every call degrades gracefully when the
// UI runs in a plain browser (`pnpm dev`), so the popover can be developed without Tauri.

import { getVersion } from "@tauri-apps/api/app";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import * as autostart from "@tauri-apps/plugin-autostart";

export const inTauri = isTauri();

/** Mirrors `ShortcutStatus` in src-tauri/src/shortcut.rs. */
export type ShortcutStatus = {
  readonly enabled: boolean;
  readonly registered: boolean;
  readonly label: string;
};

/** Event the Rust side emits every time the popover is shown. */
const POPOVER_SHOWN = "popover-shown";

export async function hidePopover(): Promise<void> {
  if (inTauri) await invoke("hide_popover");
}

export async function quitApp(): Promise<void> {
  if (inTauri) await invoke("quit_app");
}

/** The OS 12h/24h preference, or null when it can't be read (fall back to the locale). */
export async function systemHour12(): Promise<boolean | null> {
  return inTauri ? invoke<boolean | null>("system_hour12") : null;
}

/** The OS time zone straight from the system, which picks up changes while the app runs. */
export async function systemTimeZone(): Promise<string | null> {
  return inTauri ? invoke<string | null>("system_time_zone") : null;
}

export async function shortcutStatus(): Promise<ShortcutStatus | null> {
  return inTauri ? invoke<ShortcutStatus>("shortcut_status") : null;
}

export async function setShortcutEnabled(enabled: boolean): Promise<ShortcutStatus | null> {
  return inTauri ? invoke<ShortcutStatus>("set_shortcut_enabled", { enabled }) : null;
}

export async function isLaunchAtLoginEnabled(): Promise<boolean> {
  return inTauri ? autostart.isEnabled() : false;
}

export async function setLaunchAtLogin(enabled: boolean): Promise<void> {
  if (!inTauri) return;
  await (enabled ? autostart.enable() : autostart.disable());
}

export async function appVersion(): Promise<string> {
  return inTauri ? getVersion() : "dev";
}

/** Calls `handler` each time the popover opens. Returns an unsubscribe function. */
export async function onPopoverShown(handler: () => void): Promise<() => void> {
  if (!inTauri) return () => {};
  return listen(POPOVER_SHOWN, handler);
}
