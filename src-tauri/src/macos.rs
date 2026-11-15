//! macOS-only popover behavior.
//!
//! A regular window can't appear over another app's full-screen Space, and showing it
//! activates Zonvy, which makes macOS switch Spaces. So the popover becomes a
//! non-activating NSPanel (like Spotlight) that joins every Space as a full-screen
//! auxiliary window. It's placed just under the menu bar icon by hand: the positioner
//! plugin puts the window's top at the icon's top, which covers the menu bar once the
//! panel sits at menu-bar level.

use objc2_app_kit::{NSWindowCollectionBehavior, NSWindowStyleMask};
use std::sync::Mutex;

use tauri::tray::TrayIconEvent;
use tauri::{
    AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, Position, Rect, Runtime, Size,
    WebviewWindow,
};
use tauri_nspanel::{ManagerExt, PanelLevel, WebviewWindowExt, tauri_panel};

use crate::tray;

/// Gap between the menu bar and the popover, in points.
const MENU_BAR_GAP: f64 = 4.0;
/// Minimum distance from the screen edge, in points.
const SCREEN_MARGIN: f64 = 8.0;

tauri_panel! {
    panel!(PopoverPanel {
        config: {
            // Borderless panels can't take keyboard focus by default; the search box needs it.
            can_become_key_window: true,
            is_floating_panel: true
        }
    })
}

/// Converts the popover window into a panel. Call once from `setup` (main thread).
pub fn init<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    let panel = window.to_panel::<PopoverPanel<R>>()?;
    panel.set_level(PanelLevel::Status.value());
    if let Err(error) = panel.add_style_mask(NSWindowStyleMask::NonactivatingPanel) {
        eprintln!("zonvy: could not make popover non-activating: {error:?}");
    }
    panel.set_collection_behavior(
        NSWindowCollectionBehavior::CanJoinAllSpaces
            | NSWindowCollectionBehavior::FullScreenAuxiliary
            | NSWindowCollectionBehavior::Stationary
            | NSWindowCollectionBehavior::IgnoresCycle,
    );
    panel.set_hides_on_deactivate(false);
    Ok(())
}

/// Shows the panel and gives it keyboard focus without activating the app.
pub fn show<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    position_under_tray_icon(app, window);
    match app.get_webview_panel(crate::popover::LABEL) {
        Ok(panel) => panel.show_and_make_key(),
        Err(error) => eprintln!("zonvy: popover panel missing: {error:?}"),
    }
}

pub fn hide<R: Runtime>(app: &AppHandle<R>) {
    match app.get_webview_panel(crate::popover::LABEL) {
        Ok(panel) => panel.hide(),
        Err(error) => eprintln!("zonvy: popover panel missing: {error:?}"),
    }
}

/// Last known menu bar icon rectangle, captured from tray events. `TrayIcon::rect()` can
/// come back empty, and the positioner plugin's copy isn't public.
#[derive(Default)]
pub struct TrayAnchor(Mutex<Option<Rect>>);

/// Call from the tray event handler so the popover can line up with the icon.
pub fn remember_tray_rect<R: Runtime>(app: &AppHandle<R>, event: &TrayIconEvent) {
    let rect = match event {
        TrayIconEvent::Click { rect, .. }
        | TrayIconEvent::Enter { rect, .. }
        | TrayIconEvent::Move { rect, .. } => *rect,
        _ => return,
    };
    if let Ok(mut anchor) = app.state::<TrayAnchor>().0.lock() {
        *anchor = Some(rect);
    }
}

/// Places the popover just below the menu bar: centered under the icon when its position
/// is known, otherwise at the top-right of the screen the pointer is on, like a system menu.
fn position_under_tray_icon<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    match target_position(app, window) {
        Some(position) => {
            if let Err(error) = window.set_position(position) {
                eprintln!("zonvy: could not position popover: {error}");
            }
        }
        None => eprintln!("zonvy: no screen found to position the popover"),
    }
}

fn target_position<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
) -> Option<PhysicalPosition<i32>> {
    let monitor = active_monitor(app)?;
    let scale = monitor.scale_factor();
    let width = f64::from(window.outer_size().ok()?.width);

    let area = monitor.work_area(); // excludes the menu bar (and the Dock)
    let screen_left = f64::from(monitor.position().x) + SCREEN_MARGIN * scale;
    let screen_right = f64::from(monitor.position().x) + f64::from(monitor.size().width)
        - SCREEN_MARGIN * scale
        - width;
    let menu_bar_bottom = f64::from(area.position.y);

    let (x, y) = match tray_rect(app) {
        Some(rect) => {
            let (icon_pos, icon_size) = physical_rect(rect, scale);
            let centered = icon_pos.x + icon_size.width / 2.0 - width / 2.0;
            (centered, menu_bar_bottom.max(icon_pos.y + icon_size.height))
        }
        None => (screen_right, menu_bar_bottom),
    };
    let x = x.clamp(screen_left, screen_right.max(screen_left));
    let y = y + MENU_BAR_GAP * scale;
    Some(PhysicalPosition::new(x.round() as i32, y.round() as i32))
}

fn tray_rect<R: Runtime>(app: &AppHandle<R>) -> Option<Rect> {
    let remembered = app.state::<TrayAnchor>().0.lock().ok().and_then(|r| *r);
    remembered.or_else(|| app.tray_by_id(tray::TRAY_ID)?.rect().ok().flatten())
}

/// The icon sits on the screen the pointer is on (it was just clicked, or the user is
/// working there when using the shortcut); fall back to the main screen.
fn active_monitor<R: Runtime>(app: &AppHandle<R>) -> Option<Monitor> {
    let from_cursor = app
        .cursor_position()
        .ok()
        .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten());
    from_cursor.or_else(|| app.primary_monitor().ok().flatten())
}

fn physical_rect(rect: Rect, scale: f64) -> (PhysicalPosition<f64>, PhysicalSize<f64>) {
    let position = match rect.position {
        Position::Physical(p) => PhysicalPosition::new(f64::from(p.x), f64::from(p.y)),
        Position::Logical(l) => l.to_physical(scale),
    };
    let size = match rect.size {
        Size::Physical(s) => PhysicalSize::new(f64::from(s.width), f64::from(s.height)),
        Size::Logical(l) => l.to_physical(scale),
    };
    (position, size)
}

/// The panel's live visibility (Tauri's own `is_visible` may lag after panel calls).
pub fn is_visible<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.get_webview_panel(crate::popover::LABEL)
        .map(|panel| panel.is_visible())
        .unwrap_or(false)
}

/// Makes sure the plugin is registered; used by `lib.rs`.
pub fn plugin<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri_nspanel::init()
}
