//! Menu bar (macOS) / system tray (Windows, Linux) icon.
//!
//! macOS and Windows: left click toggles the popover, right click opens a small menu.
//! Linux: tray clicks aren't delivered, so the menu (Open / Quit) is the way in.

use tauri::image::Image;
use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Runtime};

use crate::popover;

pub const TRAY_ID: &str = "zonvy";
const MENU_OPEN: &str = "open";
const MENU_QUIT: &str = "quit";

pub fn create<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<TrayIcon<R>> {
    let open = MenuItem::with_id(app, MENU_OPEN, "Open Zonvy", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, MENU_QUIT, "Quit Zonvy", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &separator, &quit])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon()?)
        .icon_as_template(cfg!(target_os = "macos"))
        .tooltip("Zonvy")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(on_menu_event)
        .on_tray_icon_event(on_tray_event)
        .build(app)
}

/// macOS gets a black "template" glyph that the system tints for light/dark menu bars;
/// Windows and Linux get a colored icon that reads on both light and dark taskbars.
fn icon() -> tauri::Result<Image<'static>> {
    #[cfg(target_os = "macos")]
    let bytes: &[u8] = include_bytes!("../icons/tray-template.png");
    #[cfg(not(target_os = "macos"))]
    let bytes: &[u8] = include_bytes!("../icons/tray.png");
    Image::from_bytes(bytes)
}

fn on_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match event.id.as_ref() {
        MENU_OPEN => popover::show(app),
        MENU_QUIT => app.exit(0),
        _ => {}
    }
}

fn on_tray_event<R: Runtime>(tray: &TrayIcon<R>, event: TrayIconEvent) {
    let app = tray.app_handle();
    // Lets the positioner plugin anchor the popover to the icon.
    tauri_plugin_positioner::on_tray_event(app, &event);
    #[cfg(target_os = "macos")]
    crate::macos::remember_tray_rect(app, &event);

    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    {
        popover::toggle(app);
    }
}
