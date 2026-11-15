//! macOS-only popover behavior.
//!
//! A regular window can't appear over another app's full-screen Space, and showing it
//! activates Zonvy, which makes macOS switch Spaces. So the popover becomes a
//! non-activating NSPanel (like Spotlight) that joins every Space as a full-screen
//! auxiliary window. It's placed just under the menu bar icon by hand: the positioner
//! plugin puts the window's top at the icon's top, which covers the menu bar once the
//! panel sits at menu-bar level.

use objc2_app_kit::{NSWindowCollectionBehavior, NSWindowStyleMask};
use tauri::{AppHandle, PhysicalPosition, Runtime, WebviewWindow};
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

/// Centers the popover under the menu bar icon, kept inside the screen. Falls back to
/// the top center of the main screen when the icon's position isn't known.
fn position_under_tray_icon<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let Some(position) = target_position(app, window) else {
        if let Err(error) = window.center() {
            eprintln!("zonvy: could not position popover: {error}");
        }
        return;
    };
    if let Err(error) = window.set_position(position) {
        eprintln!("zonvy: could not position popover: {error}");
    }
}

fn target_position<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
) -> Option<PhysicalPosition<i32>> {
    let rect = app.tray_by_id(tray::TRAY_ID)?.rect().ok().flatten()?;
    let icon_pos = rect.position.to_physical::<f64>(1.0);
    let icon_size = rect.size.to_physical::<f64>(1.0);
    let window_size = window.outer_size().ok()?;
    let monitor = app
        .monitor_from_point(icon_pos.x, icon_pos.y)
        .ok()
        .flatten()?;
    let scale = monitor.scale_factor();

    let width = f64::from(window_size.width);
    let screen_left = f64::from(monitor.position().x) + SCREEN_MARGIN * scale;
    let screen_right = f64::from(monitor.position().x) + f64::from(monitor.size().width)
        - SCREEN_MARGIN * scale
        - width;

    let x = (icon_pos.x + icon_size.width / 2.0 - width / 2.0)
        .clamp(screen_left, screen_right.max(screen_left));
    let y = icon_pos.y + icon_size.height + MENU_BAR_GAP * scale;
    Some(PhysicalPosition::new(x.round() as i32, y.round() as i32))
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
