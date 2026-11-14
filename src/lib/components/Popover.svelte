<script lang="ts">
  import type { Snippet } from "svelte";
  import { tick } from "svelte";
  import { citiesById, searchCities } from "$lib/cities/index.ts";
  import type { City } from "$lib/cities/types.ts";
  import { resolvePins } from "$lib/pins/pins.ts";
  import CityRow from "./CityRow.svelte";

  type Props = {
    pinnedIds: readonly number[];
    now: Date;
    localTz: string;
    hour12: boolean;
    onPin: (id: number) => void;
    onUnpin: (id: number) => void;
    onReorder: (from: number, to: number) => void;
    onClose: () => void;
    /** Rendered under the list when the gear is toggled on. */
    settings: Snippet<[close: () => void]>;
  };

  let { pinnedIds, now, localTz, hour12, onPin, onUnpin, onReorder, onClose, settings }: Props =
    $props();

  let query = $state("");
  let activeIndex = $state(0);
  let settingsOpen = $state(false);
  let dragFrom = $state<number | null>(null);
  let input: HTMLInputElement | undefined = $state();
  let list: HTMLDivElement | undefined = $state();

  const searching = $derived(query.trim() !== "");
  const pinnedSet = $derived(new Set(pinnedIds));
  const rows = $derived<City[]>(
    searching ? searchCities(query) : resolvePins(pinnedIds, citiesById),
  );
  const duplicateNames = $derived(namesSeenTwice(rows));

  /** Called by the page each time the popover opens. */
  export function reset(): void {
    query = "";
    activeIndex = 0;
    settingsOpen = false;
    tick().then(() => input?.focus());
  }

  function namesSeenTwice(cities: readonly City[]): Set<string> {
    // Plain loop instead of Map.groupBy, which older macOS WebKit lacks.
    const seen = new Set<string>();
    const twice = new Set<string>();
    for (const { name } of cities) (seen.has(name) ? twice : seen).add(name);
    return twice;
  }

  function toggle(city: City | undefined): void {
    if (!city) return;
    if (pinnedSet.has(city.id)) onUnpin(city.id);
    else onPin(city.id);
  }

  function moveActive(delta: number): void {
    if (rows.length === 0) return;
    activeIndex = Math.min(Math.max(activeIndex + delta, 0), rows.length - 1);
    tick().then(() =>
      list?.querySelector(`#row-${activeIndex}`)?.scrollIntoView({ block: "nearest" }),
    );
  }

  function onKeydown(event: KeyboardEvent): void {
    const reorderKey = event.altKey && !searching;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (reorderKey && activeIndex < rows.length - 1) onReorder(activeIndex, activeIndex + 1);
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (reorderKey && activeIndex > 0) onReorder(activeIndex, activeIndex - 1);
        moveActive(-1);
        break;
      case "Enter":
        event.preventDefault();
        toggle(rows[activeIndex]);
        break;
      case "Escape":
        event.preventDefault();
        onClose();
        break;
    }
  }

  function onDrop(to: number): void {
    if (dragFrom !== null && dragFrom !== to) onReorder(dragFrom, to);
    dragFrom = null;
  }
</script>

<div class="popover">
  <div class="search">
    <svg class="glass" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
    <input
      bind:this={input}
      bind:value={query}
      oninput={() => (activeIndex = 0)}
      onkeydown={onKeydown}
      placeholder="Search a city…"
      aria-label="Search a city"
      aria-controls="city-list"
      aria-activedescendant={rows.length > 0 ? `row-${activeIndex}` : undefined}
      spellcheck="false"
      autocomplete="off"
    />
    <button
      class="gear"
      class:on={settingsOpen}
      type="button"
      aria-label="Settings"
      aria-expanded={settingsOpen}
      onclick={() => (settingsOpen = !settingsOpen)}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4" />
        <path
          d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </div>

  {#if settingsOpen}
    {@render settings(() => {
      settingsOpen = false;
      input?.focus();
    })}
  {:else}
    <div class="list" id="city-list" role="listbox" aria-label="Cities" bind:this={list}>
      {#each rows as city, i (city.id)}
        <div
          role="presentation"
          draggable={!searching}
          ondragstart={() => (dragFrom = i)}
          ondragover={(e) => e.preventDefault()}
          ondrop={() => onDrop(i)}
          ondragend={() => (dragFrom = null)}
          class:dragging={dragFrom === i}
        >
          <CityRow
            {city}
            {now}
            {localTz}
            {hour12}
            domId={`row-${i}`}
            pinned={pinnedSet.has(city.id)}
            active={i === activeIndex}
            showRegion={duplicateNames.has(city.name)}
            onToggle={() => toggle(city)}
            onHover={() => (activeIndex = i)}
          />
        </div>
      {:else}
        <p class="empty">
          {#if searching}
            No city matches “{query.trim()}”.
          {:else}
            Type a city name to see its local time.<br />
            Press Enter or click ☆ to pin it here.
          {/if}
        </p>
      {/each}
    </div>
  {/if}
</div>

<style>
  .popover {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .search {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 10px;
    padding: 0 6px 0 10px;
    border-radius: 7px;
    background: var(--field);
    color: var(--secondary);
  }
  .glass {
    flex: none;
  }
  input {
    flex: 1;
    min-width: 0;
    height: 28px;
    border: 0;
    outline: none;
    background: none;
    color: var(--text);
    font: inherit;
  }
  input::placeholder {
    color: var(--secondary);
  }
  .gear {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 5px;
    background: none;
    color: var(--secondary);
  }
  .gear:hover,
  .gear.on {
    background: var(--pill);
    color: var(--text);
  }
  .list {
    flex: 1;
    overflow-y: auto;
  }
  .dragging {
    opacity: 0.4;
  }
  .empty {
    margin: 0;
    padding: 24px 16px;
    border-top: 1px solid var(--separator);
    color: var(--secondary);
    text-align: center;
    line-height: 1.6;
  }
</style>
