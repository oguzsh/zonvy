//! Global keyboard shortcut that toggles the popover.
//!
//! Defaults avoid known clashes (⌥⌘T is Finder's, Ctrl+Alt+T opens a terminal on Ubuntu).
//! The on/off choice is saved in preferences.json; registration failures are reported to
//! the UI ("Shortcut unavailable") instead of being swallowed.

use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Runtime};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tauri_plugin_store::StoreExt;

/// Kept separate from the UI's settings.json so the two sides never contend for one file.
const PREFERENCES_FILE: &str = "preferences.json";
const ENABLED_KEY: &str = "shortcutEnabled";

/// Mirrors `ShortcutStatus` in src/lib/native.ts.
#[derive(Clone, Debug, Serialize)]
pub struct ShortcutStatus {
    pub enabled: bool,
    pub registered: bool,
    pub label: &'static str,
}

#[cfg(target_os = "macos")]
fn default_shortcut() -> (Shortcut, &'static str) {
    (
        Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Space),
        "⌃⌥Space",
    )
}

#[cfg(not(target_os = "macos"))]
fn default_shortcut() -> (Shortcut, &'static str) {
    (
        Shortcut::new(
            Some(Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
            Code::KeyT,
        ),
        "Ctrl+Alt+Shift+T",
    )
}

/// The shortcut that should toggle the popover (used by the plugin's handler).
pub fn is_ours(shortcut: &Shortcut) -> bool {
    *shortcut == default_shortcut().0
}

/// Registers the shortcut at startup if the user hasn't turned it off.
pub fn init<R: Runtime>(app: &AppHandle<R>) {
    if saved_enabled(app)
        && let Err(error) = register(app)
    {
        eprintln!("zonvy: global shortcut unavailable: {error}");
    }
}

pub fn status<R: Runtime>(app: &AppHandle<R>) -> ShortcutStatus {
    let (shortcut, label) = default_shortcut();
    ShortcutStatus {
        enabled: saved_enabled(app),
        registered: app.global_shortcut().is_registered(shortcut),
        label,
    }
}

pub fn set_enabled<R: Runtime>(
    app: &AppHandle<R>,
    enabled: bool,
) -> Result<ShortcutStatus, String> {
    save_enabled(app, enabled)?;
    let (shortcut, _) = default_shortcut();
    let manager = app.global_shortcut();
    if enabled && !manager.is_registered(shortcut) {
        // A failure here is shown as "Shortcut unavailable"; the preference still sticks.
        if let Err(error) = register(app) {
            eprintln!("zonvy: global shortcut unavailable: {error}");
        }
    } else if !enabled && manager.is_registered(shortcut) {
        manager.unregister(shortcut).map_err(|e| e.to_string())?;
    }
    Ok(status(app))
}

fn register<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let (shortcut, _) = default_shortcut();
    app.global_shortcut()
        .register(shortcut)
        .map_err(|e| e.to_string())
}

fn saved_enabled<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.store(PREFERENCES_FILE)
        .ok()
        .and_then(|store| store.get(ENABLED_KEY))
        .and_then(|value| value.as_bool())
        .unwrap_or(true)
}

fn save_enabled<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> Result<(), String> {
    let store = app.store(PREFERENCES_FILE).map_err(|e| e.to_string())?;
    store.set(ENABLED_KEY, json!(enabled));
    store.save().map_err(|e| e.to_string())
}
