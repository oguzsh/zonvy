#[cfg(target_os = "macos")]
mod macos;
mod popover;
mod prefs;
mod shortcut;
mod tray;

use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::ShortcutState;

#[tauri::command]
fn hide_popover(app: AppHandle) {
    popover::hide(&app);
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

// Async so they run off the main thread: on macOS hour12() spawns `defaults`.
#[tauri::command]
async fn system_hour12() -> Option<bool> {
    prefs::hour12()
}

#[tauri::command]
async fn system_time_zone() -> Option<String> {
    prefs::time_zone()
}

#[tauri::command]
fn shortcut_status(app: AppHandle) -> shortcut::ShortcutStatus {
    shortcut::status(&app)
}

#[tauri::command]
fn set_shortcut_enabled(app: AppHandle, enabled: bool) -> Result<shortcut::ShortcutStatus, String> {
    shortcut::set_enabled(&app, enabled)
}

/// macOS panel support (no-op elsewhere).
fn native_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    #[cfg(target_os = "macos")]
    return macos::plugin();
    #[cfg(not(target_os = "macos"))]
    tauri::plugin::Builder::new("zonvy-native").build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be first: a second launch (e.g. from the app launcher on GNOME) just opens the popover.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            popover::show(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, pressed, event| {
                    if event.state() == ShortcutState::Pressed && shortcut::is_ours(pressed) {
                        popover::toggle(app);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(native_plugin())
        .manage(popover::PopoverState::default())
        .setup(|app| {
            // Menu bar app: no Dock icon, no app menu.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            popover::init(app.handle())?;
            tray::create(app.handle())?;
            shortcut::init(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == popover::LABEL && matches!(event, WindowEvent::Focused(false)) {
                popover::hide(window.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![
            hide_popover,
            quit_app,
            system_hour12,
            system_time_zone,
            shortcut_status,
            set_shortcut_enabled,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Zonvy");
}
