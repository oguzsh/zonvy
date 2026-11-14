# Zonvy — Design

Date: 2026-11-14 · Status: approved 2026-11-14

## Intent

Countries like the US, Canada and Russia span many time zones. To know the time in a given city you normally need to know which zone it's in and which "reference" city or state represents that zone — or you need internet to look it up.

This app removes that step: type any sizable city name and see its current local time, **fully offline**. A few favorite cities can be pinned for at-a-glance checking.

## Goals

- Look up the current local time of any city with population ≥ ~15k, by name, offline.
- Pin favorite cities; see them instantly when the popover opens.
- Live in the macOS menu bar / Windows system tray / Linux tray. No Dock or taskbar presence.
- Minimal, native-feeling look ("A · Native" mockup, below).
- Runs on macOS, Windows, Linux (desktop only).

## Non-goals

- Mobile (iOS/Android).
- Alarms, reminders, meeting planner, "what time will it be there at 3pm my time" scrubber.
- Showing a pinned city's time as text next to the menu bar icon.
- Weather, maps, or any data beyond time.

## Anti-goals (failure even if it "works")

- **Any network request at runtime.** The app must work identically with no connection.
- **Wrong times**, especially around daylight-saving transitions or in half/quarter-hour zones (India +5:30, Nepal +5:45).
- **Feeling heavy or slow.** The popover should appear effectively instantly on click/shortcut, and search should update on every keystroke without lag.

## Constraints

- Stack: **Tauri 2** (decided).
- City → time zone data: **GeoNames `cities15000`** (CC BY 4.0, ~33k cities, each tagged with an IANA zone id). Attribution is required in the app's About screen.
- Time zone *rules* come from the OS / webview's built-in IANA data (see Approaches) — not bundled by us.
- Linux: Tauri cannot receive click events on the tray icon; a tray click can only open a native menu.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **1 ✅ chosen** | **UI-side**: city data bundled in the frontend; search in TypeScript; times via `Intl.DateTimeFormat({ timeZone })`. Rust only does tray, window, autostart, shortcut, persistence. | Least code. Clock-rule changes arrive via OS updates, no app release needed. Minor risk: tz data may differ slightly per OS; very old Linux distros may be stale. |
| 2 | **Rust core**: search + time math in Rust with `chrono-tz` (bundled tzdb). | Identical results everywhere and easy to test, but tz rules are frozen at build time — every DST/rule change worldwide needs a new release. Wrong trade-off for an app whose job is correct time. |
| 3 | Hybrid: search in Rust, time in UI. | Extra IPC round-trips for no real gain. Dropped. |

The user picked **Approach 1**.

## What the user decided

### Platforms & entry point
- **macOS**: menu bar icon; click toggles the popover anchored under the icon. App runs as an accessory (no Dock icon, no app menu).
- **Windows**: system tray icon; click toggles the popover anchored near the tray. Not shown in taskbar.
- **Linux**: tray icon opens a small native menu with **Open** and **Quit**; "Open" (or the global shortcut) shows the popover as a small window.
- Popover hides when it loses focus or on Esc.

### Popover behavior
- Opens with the search field focused.
- **Search empty** → shows pinned cities in the user's order.
- **Typing** → results replace the pinned list.
- Each row: **City, country/region** · **local time** · **offset from you** (e.g. `+3h`, `−5h30`) · a **day tag** (`Sat`) when the city's date differs from the user's local date.
- Times are live while the popover is open (update at the minute boundary).
- Matching is accent-insensitive and case-insensitive ("sao paulo" → São Paulo).
- Same-named cities are disambiguated by region (e.g. "Portland, Oregon, US" vs "Portland, Maine, US").

### Pins
- Hover a result → pin button; hover a pinned row → unpin button.
- Drag to reorder pinned cities.
- Keyboard: ↑/↓ move highlight, **Enter** pins/unpins the highlighted city, **Esc** closes.
- Pins persist locally (app config dir). Nothing leaves the machine.

### Settings (small gear menu in the popover)
- Launch at login (on/off).
- Global shortcut to open the popover (on/off). Default: **⌥⌘T** on macOS, **Ctrl+Alt+T** on Windows/Linux.
- About (version + "City data © GeoNames, CC BY 4.0").
- Quit.

### Look — "A · Native"
- Light/dark follows the system.
- System font (SF on macOS, Segoe UI on Windows, system UI on Linux); tabular numerals for times.
- ~300 px wide, rounded corners, subtle shadow; translucent/vibrancy background on macOS where available.
- Rows: city (medium weight) + small grey country code on the left; time (medium weight) + small grey offset on the right; small grey pill for the day tag.
- 12h/24h follows the system setting.

```
┌───────────────────────────────┐
│ 🔍 Search a city…           ⚙ │
├───────────────────────────────┤
│ New York   US     12:42   +3h │
│ London     GB     17:42   +8h │
│ Istanbul   TR     20:42  +11h │
│ Tokyo      JP  02:42 Sat +17h │
└───────────────────────────────┘
```

## Builder's calls (marked as mine — proposals the user can override)

- **Frontend framework**: Svelte + TypeScript + Vite (small bundle, minimal runtime). Vanilla TS would also be fine.
- **Data pipeline**: a dev-time script downloads `cities15000.txt` + `admin1CodesASCII.txt` and `countryInfo.txt` from GeoNames, and emits a compact, committed data file (fields: id, name, ascii name, country code, admin1 name, population, tz id). It is **not** fetched at runtime. Whether to include a few English alternate names (exonyms) is the builder's call, size permitting (target ≤ 2 MB uncompressed).
- **Search ranking**: normalized prefix match on name first, then word-prefix, then substring; ties broken by population (descending). Cap results at ~20 rows. Search runs on every keystroke.
- **Pins storage**: list of GeoNames ids in a JSON settings file via `tauri-plugin-store` (or equivalent).
- **Tauri plugins**: tray (core), `positioner` (anchor under tray icon), `global-shortcut`, `autostart`, `store`; `window-vibrancy` on macOS.
- **Popover window**: created once at startup, hidden/shown (not re-created) so it opens instantly. Frameless, always-on-top, skip-taskbar.
- **12h/24h detection**: webview `Intl` defaults may not reflect the macOS/Windows 12/24h override; builder should read the OS preference from Rust if needed and pass it to the UI.
- **Offset format**: `+3h`, `−5h30`, `+5h45`, `±0h` when same as local.
- **Shortcut**: on by default, fixed in v1 (on/off only); custom binding is a later nicety. Defaults avoid known clashes (⌥⌘T is used by Finder; Ctrl+Alt+T opens a terminal on Ubuntu): **⌃⌥Space** on macOS, **Ctrl+Alt+Shift+T** on Windows/Linux. If registration fails, the settings menu shows "Shortcut unavailable" instead of failing silently. *(Supersedes the defaults in "Settings" above.)*
- **Linux entry points**: GNOME has no tray without the AppIndicator extension, and on Wayland global shortcuts and window anchoring are unreliable. So the app is **single-instance**: launching it again from the app launcher shows the popover. This works on every desktop. Where anchoring isn't possible, the popover opens as a small centered window. Support levels: full on X11 and KDE; on GNOME/Wayland, launcher plus tray if the extension is present. XDG-portal global shortcuts are a later phase.
- **Linux time zone data**: WebKitGTK's `Intl` uses ICU's bundled zone data, which can lag the distro's `tzdata`. Accepted for v1: rule changes that affect sizable cities are rare. Tests include a check that flags drift against `/usr/share/zoneinfo`, and reading offsets from zoneinfo in Rust on Linux stays an option if drift shows up.
- **Mac App Store**: out of scope. The translucent popover needs Tauri's `macOSPrivateApi`, which the App Store doesn't allow.
- **Packaging**: `.dmg` (universal) for macOS, NSIS `.exe` for Windows, `.AppImage` + `.deb` for Linux, via Tauri's bundler and a CI matrix build. **Unsigned** (user decision: personal use for now): no Apple notarization, no Windows code signing, no auto-updater. On first launch, macOS needs right-click → Open and Windows needs SmartScreen "Run anyway". Signing and notarization become a separate phase if the app is ever released publicly.
- **Testing**: unit tests (Vitest) for normalization, search ranking, offset/day-tag formatting (including DST transitions and half-hour zones, using fixed instants); Rust-side kept thin. E2E: `tauri-driver` supports Windows/Linux only, so macOS UI is verified manually; builder picks the E2E scope.
- **App name**: **Zonvy** (user decision). A web search found no app by that exact name; trademark and domain availability are unchecked, which is fine for personal use.
