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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JobResult {
    pub title: String,
    pub company: String,
    pub location: String,
    pub url: String,
    pub snippet: String,
    pub source: String,
    pub salary: Option<String>,
    pub posted: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PaperResult {
    title: String,
    authors: String,
    year: Option<i32>,
    url: String,
    doi: Option<String>,
    abstract_text: String,
    cited_by_count: i32,
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

// ponytail: shared trash logic, replaces duplicated trash_file/trash_folder
fn trash_entry(vault_root: &str, rel_path: &str, is_dir: bool) -> Result<(), String> {
    let source = PathBuf::from(vault_root).join(rel_path);
    if !source.exists() {
        return Err(if is_dir { "folder not found" } else { "file not found" }.into());
    }
    if rel_path.contains("..") {
        return Err("invalid path".into());
    }

    let tdir = trash_dir(vault_root);
    fs::create_dir_all(&tdir).map_err(|e| e.to_string())?;

    let safe_name = rel_path.replace('/', "__").replace('\\', "__");
    let timestamp = chrono::Utc::now().format("%Y%m%d%H%M%S").to_string();
    let trash_name = format!("{}_{}", timestamp, safe_name);
    let dest = tdir.join(&trash_name);

    fs::rename(&source, &dest).map_err(|e| e.to_string())?;

    let mut entries = read_trash_metadata(vault_root);
    entries.push(TrashEntry {
        trash_path: trash_name,
        original_path: rel_path.to_string(),
        name: Path::new(rel_path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        is_dir,
        deleted_at: chrono::Utc::now().to_rfc3339(),
    });
    write_trash_metadata(vault_root, &entries)
}

#[tauri::command]
fn trash_file(vault_root: String, rel_path: String) -> Result<(), String> {
    trash_entry(&vault_root, &rel_path, false)
}

#[tauri::command]
fn trash_folder(vault_root: String, rel_path: String) -> Result<(), String> {
    trash_entry(&vault_root, &rel_path, true)
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
async fn web_search(query: String) -> Result<Vec<SearchResult>, String> {
    let jar = reqwest::cookie::Jar::default();
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .cookie_provider(std::sync::Arc::new(jar))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://html.duckduckgo.com/html/?q={}",
        urlencoding::encode(&query)
    );
    let resp = client
        .get(&url)
        .header("Accept", "text/html,application/xhtml+xml")
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Search failed ({})", resp.status()));
    }

    let html = resp.text().await.map_err(|e| e.to_string())?;
    let doc = scraper::Html::parse_document(&html);

    let item_sel = scraper::Selector::parse("div.result").map_err(|e| format!("{e}"))?;
    let link_sel = scraper::Selector::parse("a.result__a").map_err(|e| format!("{e}"))?;
    let snip_sel = scraper::Selector::parse("a.result__snippet").map_err(|e| format!("{e}"))?;

    let mut results = Vec::new();
    for item in doc.select(&item_sel) {
        let a = match item.select(&link_sel).next() {
            Some(a) => a,
            None => continue,
        };
        let title = a.text().collect::<String>().trim().to_string();
        let href = a
            .value()
            .attr("href")
            .and_then(|href| href.split("uddg=").nth(1))
            .and_then(|target| target.split('&').next())
            .and_then(|target| urlencoding::decode(target).ok())
            .map(|target| target.into_owned())
            .unwrap_or_default();
        let snippet = item
            .select(&snip_sel)
            .next()
            .map(|s| s.text().collect::<String>().trim().to_string())
            .unwrap_or_default();

        if !href.is_empty() && !title.is_empty() {
            results.push(SearchResult { title, url: href, snippet });
        }
        if results.len() >= 5 {
            break;
        }
    }

    Ok(results)
}

#[tauri::command]
async fn research_papers(query: String) -> Result<Vec<PaperResult>, String> {
    let url = format!(
        "https://api.openalex.org/works?search={}&per-page=5&select=id,title,authorships,publication_year,doi,primary_location,abstract_inverted_index,cited_by_count",
        urlencoding::encode(&query)
    );
    let client = reqwest::Client::builder()
        .user_agent("TrackMe/0.5 (academic research search)")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Research search failed ({})", resp.status()));
    }

    let body = resp.text().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    let mut papers = Vec::new();
    for work in data["results"].as_array().into_iter().flatten() {
        let title = work["title"].as_str().unwrap_or("Untitled paper").trim().to_string();
        let authors = work["authorships"]
            .as_array()
            .map(|items| {
                items.iter().filter_map(|item| item["author"]["display_name"].as_str()).take(4).collect::<Vec<_>>().join(", ")
            })
            .unwrap_or_default();
        let abstract_text = work["abstract_inverted_index"]
            .as_object()
            .map(|index| {
                let mut words = Vec::new();
                for (word, positions) in index {
                    if let Some(positions) = positions.as_array() {
                        for position in positions.iter().filter_map(|p| p.as_u64()) {
                            words.push((position, word.as_str()));
                        }
                    }
                }
                words.sort_by_key(|(position, _)| *position);
                words.into_iter().map(|(_, word)| word).collect::<Vec<_>>().join(" ")
            })
            .unwrap_or_default();
        let url = work["primary_location"]["landing_page_url"]
            .as_str()
            .or_else(|| work["id"].as_str())
            .unwrap_or("")
            .to_string();
        papers.push(PaperResult {
            title,
            authors,
            year: work["publication_year"].as_i64().map(|year| year as i32),
            url,
            doi: work["doi"].as_str().map(String::from),
            abstract_text: abstract_text.chars().take(700).collect(),
            cited_by_count: work["cited_by_count"].as_i64().unwrap_or(0) as i32,
        });
    }
    Ok(papers)
}

#[tauri::command]
async fn search_jobs(query: String, location: Option<String>) -> Result<Vec<JobResult>, String> {
    let search_query = match location {
        Some(loc) if !loc.is_empty() => format!("{} jobs {}", query, loc),
        _ => format!("{} jobs", query),
    };

    let jar = reqwest::cookie::Jar::default();
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .cookie_provider(std::sync::Arc::new(jar))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://www.google.com/search?q={}&ibp=htl;jobs",
        urlencoding::encode(&search_query)
    );

    let resp = client
        .get(&url)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Accept-Encoding", "gzip, deflate")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Job search failed ({})", resp.status()));
    }

    let html = resp.text().await.map_err(|e| e.to_string())?;

    // Parse Google Jobs HTML in a block to ensure scraper::Html is dropped before any await
    let mut results: Vec<JobResult> = {
        let doc = scraper::Html::parse_document(&html);

        let mut jobs = Vec::new();

        // Try parsing job cards from Google Jobs structured data
        let script_sel = scraper::Selector::parse("script").map_err(|e| format!("{e}"))?;
        for script in doc.select(&script_sel) {
            let text = script.text().collect::<String>();
            if text.contains("JobPosting") || text.contains("jobPosting") {
                if let Ok(data) = serde_json::from_str::<serde_json::Value>(&text) {
                    if let Some(items) = data["@graph"].as_array() {
                        for item in items {
                            if item["@type"].as_str() == Some("JobPosting") {
                                let title = item["title"].as_str().unwrap_or("").to_string();
                                let company = item["hiringOrganization"]["name"].as_str()
                                    .or_else(|| item["organization"]["name"].as_str())
                                    .unwrap_or("Unknown Company").to_string();
                                let job_url = item["url"].as_str().unwrap_or("").to_string();
                                let description = item["description"].as_str().unwrap_or("").to_string();
                                let job_location = item["jobLocation"]["address"]["addressLocality"].as_str()
                                    .or_else(|| item["jobLocation"].as_str())
                                    .unwrap_or("").to_string();
                                let salary = item["baseSalary"]["value"]["value"].as_f64()
                                    .map(|v| format!("{} {}", v, item["baseSalary"]["value"]["currency"].as_str().unwrap_or("USD")));
                                let posted = item["datePosted"].as_str().map(String::from);

                                if !title.is_empty() {
                                    jobs.push(JobResult {
                                        title,
                                        company,
                                        location: job_location,
                                        url: job_url,
                                        snippet: description.chars().take(200).collect(),
                                        source: "Google Jobs".to_string(),
                                        salary,
                                        posted,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Fallback: parse job cards from HTML structure if JSON-LD didn't work
        if jobs.is_empty() {
            let card_sel = scraper::Selector::parse("div.iFjolb, div.bs, li.iFjolb, div[class*='job']").map_err(|e| format!("{e}"))?;
            let title_sel = scraper::Selector::parse("div.BjJfJf, h3, div[role='heading']").map_err(|e| format!("{e}"))?;
            let company_sel = scraper::Selector::parse("div.vNEEBe, div[class*='company']").map_err(|e| format!("{e}"))?;
            let location_sel = scraper::Selector::parse("div.Qk80Jf, div[class*='location']").map_err(|e| format!("{e}"))?;
            let link_sel = scraper::Selector::parse("a").map_err(|e| format!("{e}"))?;

            for card in doc.select(&card_sel) {
                let title = card.select(&title_sel)
                    .next()
                    .map(|el| el.text().collect::<String>().trim().to_string())
                    .unwrap_or_default();

                let company = card.select(&company_sel)
                    .next()
                    .map(|el| el.text().collect::<String>().trim().to_string())
                    .unwrap_or_else(|| "Unknown Company".to_string());

                let loc = card.select(&location_sel)
                    .next()
                    .map(|el| el.text().collect::<String>().trim().to_string())
                    .unwrap_or_default();

                let job_url = card.select(&link_sel)
                    .next()
                    .and_then(|a| a.value().attr("href"))
                    .map(|href| {
                        if href.starts_with("/url?") {
                            href.split("q=").nth(1)
                                .and_then(|s| s.split('&').next())
                                .and_then(|s| urlencoding::decode(s).ok())
                                .map(|s| s.into_owned())
                                .unwrap_or_default()
                        } else {
                            href.to_string()
                        }
                    })
                    .unwrap_or_default();

                if !title.is_empty() && !job_url.is_empty() {
                    jobs.push(JobResult {
                        title,
                        company,
                        location: loc,
                        url: job_url,
                        snippet: String::new(),
                        source: "Google Jobs".to_string(),
                        salary: None,
                        posted: None,
                    });
                }
            }
        }

        jobs
    };

    // If still no results, try a regular DuckDuckGo search for jobs as final fallback
    if results.is_empty() {
        let fallback_url = format!(
            "https://html.duckduckgo.com/html/?q={}",
            urlencoding::encode(&search_query)
        );
        let fallback_resp = client
            .get(&fallback_url)
            .header("Accept", "text/html,application/xhtml+xml")
            .header("Accept-Language", "en-US,en;q=0.9")
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if fallback_resp.status().is_success() {
            let fallback_html = fallback_resp.text().await.map_err(|e| e.to_string())?;
            let fallback_doc = scraper::Html::parse_document(&fallback_html);

            let item_sel = scraper::Selector::parse("div.result").map_err(|e| format!("{e}"))?;
            let link_sel = scraper::Selector::parse("a.result__a").map_err(|e| format!("{e}"))?;
            let snip_sel = scraper::Selector::parse("a.result__snippet").map_err(|e| format!("{e}"))?;

            for item in fallback_doc.select(&item_sel) {
                let a = match item.select(&link_sel).next() {
                    Some(a) => a,
                    None => continue,
                };
                let title = a.text().collect::<String>().trim().to_string();
                let href = a.value().attr("href")
                    .and_then(|href| href.split("uddg=").nth(1))
                    .and_then(|target| target.split('&').next())
                    .and_then(|target| urlencoding::decode(target).ok())
                    .map(|target| target.into_owned())
                    .unwrap_or_default();
                let snippet = item.select(&snip_sel).next()
                    .map(|s| s.text().collect::<String>().trim().to_string())
                    .unwrap_or_default();

                if !href.is_empty() && !title.is_empty() {
                    results.push(JobResult {
                        title,
                        company: String::new(),
                        location: String::new(),
                        url: href,
                        snippet,
                        source: "Web Search".to_string(),
                        salary: None,
                        posted: None,
                    });
                }
                if results.len() >= 10 {
                    break;
                }
            }
        }
    }

    results.truncate(10);
    Ok(results)
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
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
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
            web_search,
            research_papers,
            search_jobs,
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
