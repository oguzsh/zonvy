<script lang="ts">
  import type { ShortcutStatus } from "$lib/native.ts";

  type Props = {
    launchAtLogin: boolean;
    shortcut: ShortcutStatus | null;
    version: string;
    /** Each toggle resolves to the real state afterwards, which may differ if it failed. */
    onToggleLaunchAtLogin: (enabled: boolean) => Promise<boolean>;
    onToggleShortcut: (enabled: boolean) => Promise<boolean>;
    onQuit: () => void;
    onClose: () => void;
  };

  let {
    launchAtLogin,
    shortcut,
    version,
    onToggleLaunchAtLogin,
    onToggleShortcut,
    onQuit,
    onClose,
  }: Props = $props();

  /** Svelte won't re-set `checked` if the prop value didn't change, so correct the box directly. */
  function applyToggle(box: HTMLInputElement, toggle: (enabled: boolean) => Promise<boolean>) {
    toggle(box.checked).then((actual) => (box.checked = actual));
  }

  const shortcutUnavailable = $derived(shortcut !== null && shortcut.enabled && !shortcut.registered);
</script>

<div class="menu" role="menu" aria-label="Settings">
  <label class="item">
    <input
      type="checkbox"
      checked={launchAtLogin}
      onchange={(e) => applyToggle(e.currentTarget, onToggleLaunchAtLogin)}
    />
    Launch at login
  </label>

  <label class="item">
    <input
      type="checkbox"
      checked={shortcut?.enabled ?? false}
      disabled={shortcut === null}
      onchange={(e) => applyToggle(e.currentTarget, onToggleShortcut)}
    />
    Keyboard shortcut
    <span class="hint" class:warn={shortcutUnavailable}>
      {shortcutUnavailable ? "Shortcut unavailable" : (shortcut?.label ?? "")}
    </span>
  </label>

  <div class="about">
    Zonvy {version}<br />
    City data © GeoNames, CC BY 4.0
  </div>

  <div class="actions">
    <button type="button" onclick={onClose}>Done</button>
    <button type="button" onclick={onQuit}>Quit Zonvy</button>
  </div>
</div>

<style>
  .menu {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 0;
    border-top: 1px solid var(--separator);
  }
  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
  }
  .hint {
    margin-left: auto;
    color: var(--secondary);
    font-size: 11px;
  }
  .hint.warn {
    color: var(--warning);
  }
  .about {
    padding: 8px 14px;
    color: var(--secondary);
    font-size: 11px;
    line-height: 1.5;
  }
  .actions {
    display: flex;
    justify-content: space-between;
    padding: 4px 14px 2px;
  }
  button {
    padding: 3px 10px;
    border: 1px solid var(--separator);
    border-radius: 6px;
    background: var(--pill);
    color: inherit;
    font: inherit;
  }
</style>
