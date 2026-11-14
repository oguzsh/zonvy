# Zonvy

Local time for any city with 15k+ people, from your menu bar or tray. Works fully offline:
you don't need to know which time zone a city is in.

- **macOS:** click the clock icon in the menu bar, or press **⌃⌥Space**.
- **Windows:** click the tray icon, or press **Ctrl+Alt+Shift+T**.
- **Linux:** use the tray icon's **Open Zonvy** menu item or **Ctrl+Alt+Shift+T** (X11).
  On GNOME/Wayland, launch Zonvy again from the app launcher to open it.

Type a city name, then press **Enter** or click ☆ to pin it. Pinned cities show when the
search box is empty. Drag them, or use **Alt+↑/↓**, to reorder. **Esc** closes the popover.

City data © [GeoNames](https://www.geonames.org/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Develop

Requires Rust (stable), Node 24 and pnpm. On Linux you also need the
[Tauri system dependencies](https://v2.tauri.app/start/prerequisites/#linux).

```bash
pnpm install
pnpm tauri dev      # run the app
pnpm dev            # the UI alone in a browser (pins stored in localStorage)
pnpm test           # search, time math and pin logic
pnpm check          # svelte/TS type-check
```

### Regenerate the city data

Download these into `scripts/raw/` (git-ignored):

- [cities15000.zip](https://download.geonames.org/export/dump/cities15000.zip), unzipped
- [admin1CodesASCII.txt](https://download.geonames.org/export/dump/admin1CodesASCII.txt)

Then run `pnpm data`. It writes `src/lib/data/cities.json` and fails if the result is over 2 MB.

### Regenerate the icons

`pnpm icons` draws the tray icons and app icon (`scripts/make-icons.ts`) and runs `tauri icon`.
Delete `src-tauri/icons/android` and `src-tauri/icons/ios` afterwards; Zonvy is desktop only.

## Build

```bash
pnpm tauri build                                  # this machine
pnpm tauri build --target universal-apple-darwin  # macOS, Intel + Apple Silicon
```

CI (`.github/workflows/build.yml`) builds `.dmg`, `.exe`, `.AppImage` and `.deb` artifacts on
every push to `main`.

### First launch of unsigned builds

The builds aren't signed, so the OS warns the first time:

- **macOS:** right-click Zonvy.app → **Open** → **Open**.
- **Windows:** SmartScreen → **More info** → **Run anyway**.

## Layout

| Path | What |
|---|---|
| `src/lib/cities/` | City type, compact dataset decoder, search |
| `src/lib/time/` | Offsets, day tags, clock formatting (all via `Intl`) |
| `src/lib/pins/` | Pin list operations and persistence |
| `src/lib/components/` | Popover, rows, settings menu |
| `src/lib/native.ts` | Typed calls into Rust; no-ops in a plain browser |
| `src-tauri/src/` | Tray, popover window, shortcut, OS preferences |
| `docs/superpowers/` | Design doc and build plan |
