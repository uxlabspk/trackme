mod recurrence;
mod vault;

use recurrence::{compute_occurrences, Recurrence};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use vault::VaultEntry;

#[derive(Debug, Serialize, Deserialize)]
pub struct Occurrence {
    pub date: String, // YYYY-MM-DD
    pub file_rel_path: String,
    pub title: String,
    pub time: Option<String>,
    pub duration_minutes: Option<u32>,
}

#[tauri::command]
fn bootstrap_vault(root: String) -> Result<(), String> {
    vault::bootstrap_vault(&root).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_vault_folder(root: String, sub: String) -> Result<Vec<VaultEntry>, String> {
    vault::list_folder(&root, &sub).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, contents: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_folder(path: String) -> Result<(), String> {
    if path.contains("..") {
        return Err("invalid folder path".into());
    }
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_folder(path: String) -> Result<(), String> {
    if path.contains("..") {
        return Err("invalid folder path".into());
    }
    fs::remove_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_file(from: String, to: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&to).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

/// Computes concrete calendar occurrences for a single recurrence rule,
/// between window_start and window_end (both YYYY-MM-DD).
#[tauri::command]
fn compute_meeting_occurrences(
    rule_json: String,
    window_start: String,
    window_end: String,
) -> Result<Vec<String>, String> {
    let rule: Recurrence = serde_json::from_str(&rule_json).map_err(|e| e.to_string())?;
    let start = chrono::NaiveDate::parse_from_str(&window_start, "%Y-%m-%d")
        .map_err(|e| e.to_string())?;
    let end =
        chrono::NaiveDate::parse_from_str(&window_end, "%Y-%m-%d").map_err(|e| e.to_string())?;
    let occ = compute_occurrences(&rule, start, end);
    Ok(occ.iter().map(|d| d.format("%Y-%m-%d").to_string()).collect())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            bootstrap_vault,
            list_vault_folder,
            read_file,
            write_file,
            delete_file,
            create_folder,
            delete_folder,
            rename_file,
            compute_meeting_occurrences,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
