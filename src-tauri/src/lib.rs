use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Manager;

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGEventSourceSecondsSinceLastEventType(state_id: i32, event_type: u32) -> f64;
}

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
fn get_system_idle_seconds() -> Result<f64, String> {
    #[cfg(target_os = "macos")]
    {
        let seconds = unsafe { CGEventSourceSecondsSinceLastEventType(0, u32::MAX) };
        if seconds.is_finite() && seconds >= 0.0 {
            Ok(seconds)
        } else {
            Err("System input idle time is unavailable".to_string())
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("System input monitoring is currently supported on macOS only".to_string())
    }
}

#[tauri::command]
fn activitywatch_get(path: String) -> Result<String, String> {
    run_activitywatch_request("GET", &path, None)
}

#[tauri::command]
fn activitywatch_post(path: String, body: String) -> Result<String, String> {
    run_activitywatch_request("POST", &path, Some(&body))
}

fn run_activitywatch_request(
    method: &str,
    path: &str,
    body: Option<&str>,
) -> Result<String, String> {
    let urls = activitywatch_urls(path)?;
    let mut errors = Vec::new();

    for url in urls {
        let mut command = Command::new("/usr/bin/curl");
        command.args([
            "-sS",
            "--fail-with-body",
            "--max-time",
            "10",
            "-X",
            method,
        ]);
        if let Some(body) = body {
            command.args([
                "-H",
                "Content-Type: application/json",
                "--data-binary",
                body,
            ]);
        }
        let output = command
            .arg(&url)
            .output()
            .map_err(|error| format!("Failed to contact ActivityWatch: {error}"))?;
        if output.status.success() {
            return String::from_utf8(output.stdout)
                .map_err(|error| format!("ActivityWatch returned invalid UTF-8: {error}"));
        }

        let detail = String::from_utf8_lossy(if output.stderr.is_empty() {
            &output.stdout
        } else {
            &output.stderr
        });
        errors.push(format!("{} -> {}: {}", url, output.status, detail.trim()));
    }

    Err(format!(
        "ActivityWatch request failed on all local addresses: {}",
        errors.join(" | ")
    ))
}

fn activitywatch_urls(path: &str) -> Result<[String; 3], String> {
    if !path.starts_with('/')
        || path.starts_with("//")
        || path.contains("://")
        || path.contains('\r')
        || path.contains('\n')
    {
        return Err("Invalid ActivityWatch API path".to_string());
    }
    Ok([
        format!("http://127.0.0.1:5600/api/0{path}"),
        format!("http://localhost:5600/api/0{path}"),
        format!("http://[::1]:5600/api/0{path}"),
    ])
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
            activitywatch_get,
            activitywatch_post,
            open_activitywatch_window,
            open_accessibility_settings,
            get_system_idle_seconds,
            save_report,
            show_notification,
            start_activitywatch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
