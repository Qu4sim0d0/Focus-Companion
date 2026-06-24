use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde::Deserialize;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Component;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
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
    let targets = activitywatch_targets(path)?;
    let mut errors = Vec::new();

    for target in targets {
        match send_local_http_request(method, &target, body) {
            Ok(response) => return Ok(response),
            Err(error) => errors.push(format!("{} -> {}", target.label, error)),
        }
    }

    Err(format!(
        "ActivityWatch request failed on all local addresses: {}",
        errors.join(" | ")
    ))
}

struct ActivityWatchTarget {
    label: String,
    host_header: &'static str,
    connect_host: &'static str,
    path: String,
}

fn activitywatch_targets(path: &str) -> Result<[ActivityWatchTarget; 3], String> {
    if !path.starts_with('/')
        || path.starts_with("//")
        || path.contains("://")
        || path.contains('\r')
        || path.contains('\n')
        || path.chars().any(|character| character.is_control())
    {
        return Err("Invalid ActivityWatch API path".to_string());
    }
    let api_path = format!("/api/0{path}");
    Ok([
        ActivityWatchTarget {
            label: format!("http://127.0.0.1:5600{api_path}"),
            host_header: "127.0.0.1:5600",
            connect_host: "127.0.0.1",
            path: api_path.clone(),
        },
        ActivityWatchTarget {
            label: format!("http://localhost:5600{api_path}"),
            host_header: "localhost:5600",
            connect_host: "localhost",
            path: api_path.clone(),
        },
        ActivityWatchTarget {
            label: format!("http://[::1]:5600{api_path}"),
            host_header: "[::1]:5600",
            connect_host: "::1",
            path: api_path,
        },
    ])
}

fn send_local_http_request(
    method: &str,
    target: &ActivityWatchTarget,
    body: Option<&str>,
) -> Result<String, String> {
    if method != "GET" && method != "POST" {
        return Err("Unsupported ActivityWatch request method".to_string());
    }

    let mut stream = TcpStream::connect((target.connect_host, 5600))
        .map_err(|error| format!("connect failed: {error}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(10)))
        .map_err(|error| error.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(10)))
        .map_err(|error| error.to_string())?;

    let body = body.unwrap_or("");
    let request = format!(
        "{method} {} HTTP/1.1\r\nHost: {}\r\nAccept: application/json\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        target.path,
        target.host_header,
        body.len(),
        body,
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("write failed: {error}"))?;

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|error| format!("read failed: {error}"))?;
    parse_http_response(&response)
}

fn parse_http_response(response: &str) -> Result<String, String> {
    let (headers, body) = response
        .split_once("\r\n\r\n")
        .ok_or_else(|| "invalid HTTP response".to_string())?;
    let status_line = headers
        .lines()
        .next()
        .ok_or_else(|| "missing HTTP status".to_string())?;
    let status = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|value| value.parse::<u16>().ok())
        .ok_or_else(|| format!("invalid HTTP status: {status_line}"))?;
    if (200..300).contains(&status) {
        Ok(body.to_string())
    } else {
        Err(format!("HTTP {status}: {}", body.trim()))
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
        Some(dir) if !dir.trim().is_empty() => validate_report_dir(&dir)?,
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

fn validate_report_dir(dir: &str) -> Result<PathBuf, String> {
    if dir.contains('\0') {
        return Err("Report directory cannot contain null bytes".to_string());
    }
    let path = PathBuf::from(dir.trim());
    if !path.is_absolute() {
        return Err("Report directory must be an absolute path".to_string());
    }
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("Report directory cannot contain parent-directory segments".to_string());
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_successful_http_response_body() {
        let response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"ok\":true}";
        assert_eq!(parse_http_response(response).unwrap(), "{\"ok\":true}");
    }

    #[test]
    fn rejects_failed_http_response_status() {
        let response = "HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\n\r\nnope";
        assert!(parse_http_response(response)
            .unwrap_err()
            .contains("HTTP 502"));
    }

    #[test]
    fn rejects_unsafe_activitywatch_paths() {
        assert!(activitywatch_targets("/info").is_ok());
        assert!(activitywatch_targets("http://localhost:5600/info").is_err());
        assert!(activitywatch_targets("//localhost/info").is_err());
        assert!(activitywatch_targets("/info\r\nHost: bad").is_err());
    }

    #[test]
    fn validates_custom_report_directories() {
        assert!(validate_report_dir("/tmp/focus-companion-reports").is_ok());
        assert!(validate_report_dir("relative/reports").is_err());
        assert!(validate_report_dir("/tmp/../etc").is_err());
    }
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
