use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Manager;

#[derive(Debug, Deserialize)]
struct ReportAsset {
    filename: String,
    #[serde(rename = "dataUrl")]
    data_url: String,
}

#[tauri::command]
fn start_activitywatch() -> Result<&'static str, String> {
    let candidates = [
        "/Applications/ActivityWatch.app",
        "/Applications/ActivityWatch/ActivityWatch.app",
    ];

    for candidate in candidates {
        if Path::new(candidate).exists() {
            let status = Command::new("open")
                .arg(candidate)
                .status()
                .map_err(|error| error.to_string())?;
            return if status.success() {
                Ok("started")
            } else {
                Ok("failed")
            };
        }
    }

    let status = Command::new("open")
        .arg("-a")
        .arg("ActivityWatch")
        .status()
        .map_err(|error| error.to_string())?;
    if status.success() {
        Ok("started")
    } else {
        Ok("failed")
    }
}

#[tauri::command]
fn open_activitywatch_window() -> Result<&'static str, String> {
    let status = Command::new("open")
        .arg("http://localhost:5600")
        .status()
        .map_err(|error| error.to_string())?;
    if status.success() {
        Ok("opened")
    } else {
        Ok("failed")
    }
}

#[tauri::command]
fn open_accessibility_settings() -> Result<&'static str, String> {
    let status = Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .status()
        .map_err(|error| error.to_string())?;
    if status.success() {
        Ok("opened")
    } else {
        Ok("failed")
    }
}

#[tauri::command]
fn show_notification(title: String, body: String) -> Result<bool, String> {
    let status = Command::new("osascript")
        .args([
            "-l",
            "JavaScript",
            "-e",
            "ObjC.import('Foundation'); function run(argv) { var notification = $.NSUserNotification.alloc.init; notification.title = argv[0]; notification.informativeText = argv[1]; $.NSUserNotificationCenter.defaultUserNotificationCenter.deliverNotification(notification); return true; }",
            &title,
            &body,
        ])
        .status()
        .map_err(|error| error.to_string())?;
    Ok(status.success())
}

#[tauri::command]
fn save_report(
    app: tauri::AppHandle,
    filename: String,
    markdown: String,
    assets: Vec<ReportAsset>,
    report_dir: Option<String>,
) -> Result<String, String> {
    let base_dir = match report_dir {
        Some(dir) if !dir.trim().is_empty() => PathBuf::from(dir),
        _ => app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?
            .join("reports"),
    };

    let asset_dir = base_dir.join("assets");
    fs::create_dir_all(&asset_dir).map_err(|error| error.to_string())?;

    for asset in assets {
        let bytes = decode_data_url(&asset.data_url)?;
        let asset_path = safe_join(&asset_dir, &asset.filename)?;
        fs::write(asset_path, bytes).map_err(|error| error.to_string())?;
    }

    let report_path = safe_join(&base_dir, &filename)?;
    fs::write(&report_path, markdown).map_err(|error| error.to_string())?;
    Ok(report_path.to_string_lossy().to_string())
}

fn decode_data_url(data_url: &str) -> Result<Vec<u8>, String> {
    let (_, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| "Invalid chart data URL".to_string())?;
    STANDARD.decode(encoded).map_err(|error| error.to_string())
}

fn safe_join(base: &Path, filename: &str) -> Result<PathBuf, String> {
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Unsafe filename".to_string());
    }
    Ok(base.join(filename))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            open_activitywatch_window,
            open_accessibility_settings,
            save_report,
            show_notification,
            start_activitywatch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
