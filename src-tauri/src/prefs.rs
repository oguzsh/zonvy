//! Reads OS settings the webview's `Intl` can't see reliably.

/// The user's 12h/24h choice from OS settings: `Some(true)` = 12h, `Some(false)` = 24h,
/// `None` = not set or unreadable (the UI then follows the locale).
pub fn hour12() -> Option<bool> {
    platform::hour12()
}

/// The system's current IANA zone. Read fresh each call, so travelling or changing the
/// zone in OS settings is picked up without restarting the app.
pub fn time_zone() -> Option<String> {
    match iana_time_zone::get_timezone() {
        Ok(tz) => Some(tz),
        Err(error) => {
            eprintln!("zonvy: could not read system time zone: {error}");
            None
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use std::process::Command;

    /// System Settings › General › Date & Time › "24-hour time" writes these global defaults.
    pub fn hour12() -> Option<bool> {
        if read_global_flag("AppleICUForce24HourTime") {
            Some(false)
        } else if read_global_flag("AppleICUForce12HourTime") {
            Some(true)
        } else {
            None
        }
    }

    fn read_global_flag(key: &str) -> bool {
        Command::new("defaults")
            .args(["read", "-g", key])
            .output()
            .ok()
            .filter(|out| out.status.success())
            .is_some_and(|out| String::from_utf8_lossy(&out.stdout).trim() == "1")
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use winreg::RegKey;
    use winreg::enums::HKEY_CURRENT_USER;

    /// `iTime` under Control Panel\International: "1" = 24-hour, "0" = 12-hour.
    pub fn hour12() -> Option<bool> {
        let key = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey("Control Panel\\International")
            .ok()?;
        let value: String = key.get_value("iTime").ok()?;
        match value.trim() {
            "0" => Some(true),
            "1" => Some(false),
            _ => None,
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod platform {
    /// Linux desktops differ too much; follow the locale.
    pub fn hour12() -> Option<bool> {
        None
    }
}
