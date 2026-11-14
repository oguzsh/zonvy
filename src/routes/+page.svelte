<script lang="ts">
  import { onMount } from "svelte";
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
  let hour12 = $state(localeHour12);
  let launchAtLogin = $state(false);
  let shortcut = $state<native.ShortcutStatus | null>(null);
  let version = $state("");
  let popover: Popover | undefined = $state();

  function updatePins(next: number[]): void {
    pins = next;
    savePins(next).catch((error) => console.error("Could not save pinned cities.", error));
  }

  /** Runs on launch and every time the popover opens: the OS settings may have changed. */
  async function syncWithSystem(): Promise<void> {
    const [tz, systemHour12] = await Promise.all([native.systemTimeZone(), native.systemHour12()]);
    clock.refresh(tz);
    hour12 = systemHour12 ?? localeHour12;
    popover?.reset();
  }

  async function loadSettings(): Promise<void> {
    [launchAtLogin, shortcut, version] = await Promise.all([
      native.isLaunchAtLoginEnabled(),
      native.shortcutStatus(),
      native.appVersion(),
    ]);
  }

  async function toggleLaunchAtLogin(enabled: boolean): Promise<void> {
    try {
      await native.setLaunchAtLogin(enabled);
    } catch (error) {
      console.error("Could not change launch at login.", error);
    }
    launchAtLogin = await native.isLaunchAtLoginEnabled();
  }

  async function toggleShortcut(enabled: boolean): Promise<void> {
    try {
      shortcut = await native.setShortcutEnabled(enabled);
    } catch (error) {
      console.error("Could not change the keyboard shortcut.", error);
      shortcut = await native.shortcutStatus();
    }
  }

  onMount(() => {
    let unlisten: (() => void) | undefined;
    loadPins().then((loaded) => (pins = loaded));
    loadSettings().catch((error) => console.error("Could not load settings.", error));
    syncWithSystem().catch((error) => console.error("Could not read system settings.", error));
    native.onPopoverShown(() => void syncWithSystem()).then((fn) => (unlisten = fn));
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
      onToggleLaunchAtLogin={(enabled) => void toggleLaunchAtLogin(enabled)}
      onToggleShortcut={(enabled) => void toggleShortcut(enabled)}
      onQuit={() => void native.quitApp()}
      onClose={close}
    />
  {/snippet}
</Popover>
