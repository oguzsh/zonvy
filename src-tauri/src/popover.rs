//! The popover window: created once (hidden) from tauri.conf.json, then only shown and hidden.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow};
use tauri_plugin_positioner::{Position, WindowExt};

/// Window label from tauri.conf.json.
pub const LABEL: &str = "popover";
/// Emitted on every show so the UI can refresh the clock, zone and 12h/24h setting.
const SHOWN_EVENT: &str = "popover-shown";
/// Clicking the tray icon while the popover is open first blurs (hides) it, then
/// delivers the click. Ignore a toggle that arrives this soon after a hide.
const REOPEN_GUARD: Duration = Duration::from_millis(300);

#[derive(Default)]
pub struct PopoverState {
    last_hidden: Mutex<Option<Instant>>,
}

fn window<R: Runtime>(app: &AppHandle<R>) -> Option<WebviewWindow<R>> {
    let window = app.get_webview_window(LABEL);
    if window.is_none() {
        eprintln!("zonvy: popover window '{LABEL}' not found");
    }
    window
}

pub fn show<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = window(app) else { return };
    // Anchor under/above the tray icon when its position is known; otherwise
    // (Linux, or opened by shortcut before any tray click) center on screen.
    if window.move_window(Position::TrayCenter).is_err()
        && let Err(error) = window.center()
    {
        eprintln!("zonvy: could not position popover: {error}");
    }
    if let Err(error) = window.show().and_then(|()| window.set_focus()) {
        eprintln!("zonvy: could not show popover: {error}");
    }
    if let Err(error) = window.emit(SHOWN_EVENT, ()) {
        eprintln!("zonvy: could not notify popover: {error}");
    }
}

pub fn hide<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = window(app) else { return };
    if let Err(error) = window.hide() {
        eprintln!("zonvy: could not hide popover: {error}");
    }
    if let Ok(mut last_hidden) = app.state::<PopoverState>().last_hidden.lock() {
        *last_hidden = Some(Instant::now());
    }
}

pub fn toggle<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = window(app) else { return };
    if window.is_visible().unwrap_or(false) {
        hide(app);
    } else if !just_hidden(app) {
        show(app);
    }
}

fn just_hidden<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.state::<PopoverState>()
        .last_hidden
        .lock()
        .ok()
        .and_then(|last| *last)
        .is_some_and(|at| at.elapsed() < REOPEN_GUARD)
}
