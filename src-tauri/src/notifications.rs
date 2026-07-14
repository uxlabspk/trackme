use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use chrono::{Local, NaiveTime};
use serde::Deserialize;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::recurrence::{compute_occurrences, Recurrence};

#[derive(Debug, Deserialize, Default)]
struct MeetingFrontmatter {
    title: Option<String>,
    time: Option<String>,
    #[serde(default)]
    recurrence: Option<Recurrence>,
}

#[derive(Clone)]
pub struct NotificationState {
    pub vault_path: Arc<Mutex<String>>,
    pub notified: Arc<Mutex<HashSet<String>>>,
}

impl Default for NotificationState {
    fn default() -> Self {
        Self {
            vault_path: Arc::new(Mutex::new(String::new())),
            notified: Arc::new(Mutex::new(HashSet::new())),
        }
    }
}

pub fn start_scheduler(app: AppHandle, state: NotificationState) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(60));

            let vault_path = {
                let guard = state.vault_path.lock().unwrap();
                guard.clone()
            };

            if vault_path.is_empty() {
                continue;
            }

            if let Err(e) = check_meetings(&app, &vault_path, &state.notified) {
                eprintln!("Notification scheduler error: {}", e);
            }
        }
    });
}

fn check_meetings(
    app: &AppHandle,
    vault_path: &str,
    notified: &Arc<Mutex<HashSet<String>>>,
) -> Result<(), String> {
    let meetings_dir = PathBuf::from(vault_path).join("meetings");
    if !meetings_dir.exists() {
        return Ok(());
    }

    let today = Local::now().format("%Y-%m-%d").to_string();
    let now = Local::now();
    let current_time = now.time();

    // Clean up old notifications from previous days
    {
        let mut notified_guard = notified.lock().unwrap();
        notified_guard.retain(|key| key.ends_with(&format!("_{}", today)));
    }

    let entries = fs::read_dir(&meetings_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if !path.extension().map_or(false, |ext| ext == "md") {
            continue;
        }

        let raw = match fs::read_to_string(&path) {
            Ok(r) => r,
            Err(_) => continue,
        };

        let frontmatter = match parse_frontmatter(&raw) {
            Ok(fm) => fm,
            Err(_) => continue,
        };

        let Some(recurrence) = &frontmatter.recurrence else {
            continue;
        };

        let Some(time_str) = &frontmatter.time else {
            continue;
        };

        let start = match chrono::NaiveDate::parse_from_str(&today, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => continue,
        };

        let occ = compute_occurrences(recurrence, start, start);
        if occ.is_empty() {
            continue;
        }

        let meeting_time = match NaiveTime::parse_from_str(time_str, "%H:%M") {
            Ok(t) => t,
            Err(_) => continue,
        };

        let minutes_until = (meeting_time - current_time).num_minutes();

        // Notify 10 minutes before and at start time
        if minutes_until < 0 || minutes_until > 10 {
            continue;
        }

        let file_name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let notification_key = format!("{}_{}", file_name, today);

        {
            let mut notified_guard = notified.lock().unwrap();
            if notified_guard.contains(&notification_key) {
                continue;
            }
            notified_guard.insert(notification_key);
        }

        let title = frontmatter.title.as_deref().unwrap_or("Meeting");

        let body = if minutes_until == 0 {
            format!("Starting now: {} at {}", title, time_str)
        } else {
            format!(
                "In {} minute{}: {} at {}",
                minutes_until,
                if minutes_until == 1 { "" } else { "s" },
                title,
                time_str
            )
        };

        if let Err(e) = app
            .notification()
            .builder()
            .title("TrackMe")
            .body(&body)
            .show()
        {
            eprintln!("Failed to send notification: {}", e);
        }
    }

    Ok(())
}

fn parse_frontmatter(raw: &str) -> Result<MeetingFrontmatter, String> {
    let content = if raw.starts_with("---") {
        let rest = &raw[3..];
        if let Some(end) = rest.find("---") {
            &rest[..end]
        } else {
            ""
        }
    } else {
        ""
    };

    serde_yaml::from_str(content).map_err(|e| e.to_string())
}
