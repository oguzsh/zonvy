<script lang="ts">
  import { onMount } from "svelte";
  import { citiesById } from "$lib/cities/index.ts";
  import { createClock } from "$lib/clock.svelte.ts";
  import Popover from "$lib/components/Popover.svelte";
  import SettingsMenu from "$lib/components/SettingsMenu.svelte";
  import * as native from "$lib/native.ts";
  import { loadPins, savePins } from "$lib/pins/persistence.ts";
  import { addPin, movePin, removePin } from "$lib/pins/pins.ts";

  const clock = createClock();
  const localeHour12 =
    new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12 ?? false;

  let pins = $state<number[]>([]);
  /** Pins edited before the saved list finished loading are merged in, not lost. */
  let pinsLoaded = false;
  let hour12 = $state(localeHour12);
  let launchAtLogin = $state(false);
  let shortcut = $state<native.ShortcutStatus | null>(null);
  let version = $state("");
  let popover: Popover | undefined = $state();

  function persist(next: readonly number[]): void {
    savePins(next).catch((error) => console.error("Could not save pinned cities.", error));
  }

  function updatePins(next: number[]): void {
    pins = next;
    if (pinsLoaded) persist(next);
  }

  /** Saved pins + any made during startup, minus ids no longer in the dataset. */
  async function restorePins(): Promise<void> {
    const saved = await loadPins();
    const merged = [...new Set([...saved, ...pins])].filter((id) => citiesById.has(id));
    pins = merged;
    pinsLoaded = true;
    if (merged.length !== saved.length || merged.some((id, i) => id !== saved[i])) persist(merged);
  }

  /** The OS zone and 12h/24h setting may have changed since the last open. */
  async function syncWithSystem(): Promise<void> {
    const [tz, systemHour12] = await Promise.all([native.systemTimeZone(), native.systemHour12()]);
    clock.refresh(tz);
    hour12 = systemHour12 ?? localeHour12;
  }

  function onShown(): void {
    // Reset first, synchronously, so nothing typed right after opening gets wiped.
    popover?.reset();
    clock.refresh();
    syncWithSystem().catch((error) => console.error("Could not read system settings.", error));
  }

  async function loadSettings(): Promise<void> {
    [launchAtLogin, shortcut, version] = await Promise.all([
      native.isLaunchAtLoginEnabled(),
      native.shortcutStatus(),
      native.appVersion(),
    ]);
  }

  /** Returns the real state afterwards, so the checkbox can be corrected if the change failed. */
  async function toggleLaunchAtLogin(enabled: boolean): Promise<boolean> {
    try {
      await native.setLaunchAtLogin(enabled);
    } catch (error) {
      console.error("Could not change launch at login.", error);
    }
    launchAtLogin = await native.isLaunchAtLoginEnabled();
    return launchAtLogin;
  }

  async function toggleShortcut(enabled: boolean): Promise<boolean> {
    try {
      shortcut = await native.setShortcutEnabled(enabled);
    } catch (error) {
      console.error("Could not change the keyboard shortcut.", error);
      shortcut = await native.shortcutStatus();
    }
    return shortcut?.enabled ?? false;
  }

  onMount(() => {
    let unlisten: (() => void) | undefined;
    restorePins().catch((error) => console.error("Could not restore pinned cities.", error));
    loadSettings().catch((error) => console.error("Could not load settings.", error));
    syncWithSystem().catch((error) => console.error("Could not read system settings.", error));
    native.onPopoverShown(onShown).then((fn) => (unlisten = fn));
    return () => {
      unlisten?.();
      clock.stop();
    };
  });
</script>

<Popover
  bind:this={popover}
  pinnedIds={pins}
  now={clock.now}
  localTz={clock.localTz}
  {hour12}
  onPin={(id) => updatePins(addPin(pins, id))}
  onUnpin={(id) => updatePins(removePin(pins, id))}
  onReorder={(from, to) => updatePins(movePin(pins, from, to))}
  onClose={() => void native.hidePopover()}
>
  {#snippet settings(close: () => void)}
    <SettingsMenu
      {launchAtLogin}
      {shortcut}
      {version}
      onToggleLaunchAtLogin={toggleLaunchAtLogin}
      onToggleShortcut={toggleShortcut}
      onQuit={() => void native.quitApp()}
      onClose={close}
    />
  {/snippet}
</Popover>
