<script lang="ts">
  import type { City } from "$lib/cities/types.ts";
  import { dayTag, formatClock, formatOffset } from "$lib/time/format.ts";
  import { isValidZone, relativeOffsetMinutes } from "$lib/time/zone.ts";

  type Props = {
    city: City;
    now: Date;
    localTz: string;
    hour12: boolean;
    pinned: boolean;
    active: boolean;
    /** Show "Oregon, US" instead of "US" when another visible row has the same name. */
    showRegion: boolean;
    domId: string;
    onToggle: () => void;
    onHover: () => void;
  };

  let { city, now, localTz, hour12, pinned, active, showRegion, domId, onToggle, onHover }: Props =
    $props();

  const valid = $derived(isValidZone(city.tz) && isValidZone(localTz));
  const time = $derived(valid ? formatClock(now, city.tz, hour12) : "—");
  const offset = $derived(valid ? formatOffset(relativeOffsetMinutes(now, city.tz, localTz)) : "");
  const tag = $derived(valid ? dayTag(now, city.tz, localTz) : null);
  const place = $derived(showRegion && city.admin1 ? `${city.admin1}, ${city.cc}` : city.cc);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events (keyboard handled by the listbox) -->
<div
  id={domId}
  class="row"
  class:active
  role="option"
  aria-selected={active}
  tabindex="-1"
  onmouseenter={onHover}
  ondblclick={onToggle}
>
  <span class="place">
    <span class="city">{city.name}</span>
    <span class="cc">{place}</span>
  </span>
  <span class="when">
    {#if tag}<span class="tag">{tag}</span>{/if}
    <span class="time">{time}</span>
    <span class="off">{offset}</span>
  </span>
  <button
    class="pin"
    class:pinned
    type="button"
    tabindex="-1"
    aria-label={pinned ? `Unpin ${city.name}` : `Pin ${city.name}`}
    title={pinned ? "Unpin" : "Pin"}
    onclick={(e) => {
      e.stopPropagation();
      onToggle();
    }}
  >
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M8 1.5l1.9 4 4.4.5-3.3 3 .9 4.4L8 11.2l-3.9 2.2.9-4.4-3.3-3 4.4-.5z"
        fill={pinned ? "currentColor" : "none"}
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--row-height);
    padding: 0 10px 0 14px;
    border-top: 1px solid var(--separator);
    cursor: default;
  }
  .row.active {
    background: var(--row-active);
  }
  .place {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .city {
    font-weight: 500;
  }
  .cc {
    margin-left: 4px;
    color: var(--secondary);
    font-size: 11px;
  }
  .when {
    display: flex;
    align-items: center;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }
  .time {
    font-weight: 500;
  }
  .off {
    width: 42px;
    text-align: right;
    color: var(--secondary);
    font-size: 11px;
  }
  .tag {
    font-size: 10px;
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--pill);
    color: var(--pill-text);
  }
  .pin {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: none;
    color: var(--secondary);
    visibility: hidden;
  }
  .row:hover .pin,
  .row.active .pin,
  .pin.pinned {
    visibility: visible;
  }
  .pin.pinned {
    color: var(--accent);
  }
  .pin:hover {
    background: var(--pill);
  }
</style>
