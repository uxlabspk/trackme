use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VaultEntry {
    pub name: String,
    /// Path relative to the vault root, using forward slashes.
    pub rel_path: String,
    pub is_dir: bool,
    pub children: Vec<VaultEntry>,
}

/// Ensures the standard TrackMe vault folder structure exists under `root`.
/// Safe to call repeatedly; never overwrites existing files.
pub fn bootstrap_vault(root: &str) -> anyhow::Result<()> {
    let root = Path::new(root);
    fs::create_dir_all(root)?;
    for sub in ["notes", "meetings", "todos", "projects", ".trackme", ".trackme/trash"] {
        fs::create_dir_all(root.join(sub))?;
    }

    Ok(())
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

fn walk_dir(dir: &Path, root: &Path) -> anyhow::Result<Vec<VaultEntry>> {
    let mut entries = Vec::new();
    let read_dir = match fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(_) => return Ok(entries),
    };

    for entry in read_dir {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if is_hidden(&name) {
            continue;
        }

        let rel_path = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        if path.is_dir() {
            let children = walk_dir(&path, root)?;
            entries.push(VaultEntry {
                name,
                rel_path,
                is_dir: true,
                children,
            });
        } else if name.ends_with(".md") {
            entries.push(VaultEntry {
                name,
                rel_path,
                is_dir: false,
                children: Vec::new(),
            });
        }
    }

    entries.sort_by(|a, b| {
        // directories first, then alphabetical
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

pub fn list_folder(root: &str, sub: &str) -> anyhow::Result<Vec<VaultEntry>> {
    let root_path = PathBuf::from(root);
    let target = root_path.join(sub);
    walk_dir(&target, &root_path)
}
