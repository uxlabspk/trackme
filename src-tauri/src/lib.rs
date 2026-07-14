mod notifications;
mod recurrence;
mod vault;

use notifications::{start_scheduler, NotificationState};
use recurrence::{compute_occurrences, Recurrence};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use vault::VaultEntry;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TrashEntry {
    trash_path: String,
    original_path: String,
    name: String,
    is_dir: bool,
    deleted_at: String,
}

fn trash_metadata_path(vault_root: &str) -> PathBuf {
    PathBuf::from(vault_root).join(".trackme").join("trash.json")
}

fn read_trash_metadata(vault_root: &str) -> Vec<TrashEntry> {
    let p = trash_metadata_path(vault_root);
    if !p.exists() {
        return Vec::new();
    }
    fs::read_to_string(&p)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_trash_metadata(vault_root: &str, entries: &[TrashEntry]) -> Result<(), String> {
    let p = trash_metadata_path(vault_root);
    let json = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
    fs::write(&p, json).map_err(|e| e.to_string())
}

fn trash_dir(vault_root: &str) -> PathBuf {
    PathBuf::from(vault_root).join(".trackme").join("trash")
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Occurrence {
    pub date: String,
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
fn file_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
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

#[tauri::command]
fn trash_file(vault_root: String, rel_path: String) -> Result<(), String> {
    let source = PathBuf::from(&vault_root).join(&rel_path);
    if !source.exists() {
        return Err("file not found".into());
    }

    let tdir = trash_dir(&vault_root);
    fs::create_dir_all(&tdir).map_err(|e| e.to_string())?;

    let safe_name = rel_path.replace('/', "__").replace('\\', "__");
    let timestamp = chrono::Utc::now().format("%Y%m%d%H%M%S").to_string();
    let trash_name = format!("{}_{}", timestamp, safe_name);
    let dest = tdir.join(&trash_name);

    fs::rename(&source, &dest).map_err(|e| e.to_string())?;

    let mut entries = read_trash_metadata(&vault_root);
    entries.push(TrashEntry {
        trash_path: trash_name,
        original_path: rel_path.clone(),
        name: Path::new(&rel_path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        is_dir: false,
        deleted_at: chrono::Utc::now().to_rfc3339(),
    });
    write_trash_metadata(&vault_root, &entries)
}

#[tauri::command]
fn trash_folder(vault_root: String, rel_path: String) -> Result<(), String> {
    let source = PathBuf::from(&vault_root).join(&rel_path);
    if !source.exists() {
        return Err("folder not found".into());
    }
    if rel_path.contains("..") {
        return Err("invalid path".into());
    }

    let tdir = trash_dir(&vault_root);
    fs::create_dir_all(&tdir).map_err(|e| e.to_string())?;

    let safe_name = rel_path.replace('/', "__").replace('\\', "__");
    let timestamp = chrono::Utc::now().format("%Y%m%d%H%M%S").to_string();
    let trash_name = format!("{}_{}", timestamp, safe_name);
    let dest = tdir.join(&trash_name);

    fs::rename(&source, &dest).map_err(|e| e.to_string())?;

    let mut entries = read_trash_metadata(&vault_root);
    entries.push(TrashEntry {
        trash_path: trash_name,
        original_path: rel_path.clone(),
        name: Path::new(&rel_path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        is_dir: true,
        deleted_at: chrono::Utc::now().to_rfc3339(),
    });
    write_trash_metadata(&vault_root, &entries)
}

#[tauri::command]
fn list_trash(vault_root: String) -> Result<Vec<TrashEntry>, String> {
    Ok(read_trash_metadata(&vault_root))
}

#[tauri::command]
fn restore_trash(vault_root: String, trash_path: String) -> Result<(), String> {
    let mut entries = read_trash_metadata(&vault_root);
    let idx = entries.iter().position(|e| e.trash_path == trash_path);
    let entry = idx
        .map(|i| entries.remove(i))
        .ok_or("trash entry not found")?;

    let source = trash_dir(&vault_root).join(&trash_path);
    if !source.exists() {
        return Err("trashed file not found on disk".into());
    }

    let dest = PathBuf::from(&vault_root).join(&entry.original_path);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::rename(&source, &dest).map_err(|e| e.to_string())?;
    write_trash_metadata(&vault_root, &entries)
}

#[tauri::command]
fn permanent_delete_trash(vault_root: String, trash_path: String) -> Result<(), String> {
    let mut entries = read_trash_metadata(&vault_root);
    let idx = entries.iter().position(|e| e.trash_path == trash_path);
    let entry = idx
        .map(|i| entries.remove(i))
        .ok_or("trash entry not found")?;

    let source = trash_dir(&vault_root).join(&trash_path);
    if entry.is_dir {
        fs::remove_dir_all(&source).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&source).map_err(|e| e.to_string())?;
    }

    write_trash_metadata(&vault_root, &entries)
}

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

#[tauri::command]
fn set_vault_path(state: tauri::State<NotificationState>, path: String) {
    *state.vault_path.lock().unwrap() = path;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .manage(NotificationState::default())
        .invoke_handler(tauri::generate_handler![
            bootstrap_vault,
            list_vault_folder,
            read_file,
            file_exists,
            write_file,
            delete_file,
            create_folder,
            delete_folder,
            rename_file,
            compute_meeting_occurrences,
            trash_file,
            trash_folder,
            list_trash,
            restore_trash,
            permanent_delete_trash,
            set_vault_path,
        ])
        .setup(|app| {
            let show_item =
                MenuItemBuilder::with_id("show", "Show TrackMe").build(app)?;
            let quit_item =
                MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&quit_item)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("TrackMe")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            let state = app.state::<NotificationState>();
            start_scheduler(app.handle().clone(), state.inner().clone());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
