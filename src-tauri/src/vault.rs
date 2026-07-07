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
    for sub in ["notes", "meetings", "todos", "projects", ".trackme"] {
        fs::create_dir_all(root.join(sub))?;
    }

    let todos_default = root.join("todos").join("todos.md");
    if !todos_default.exists() {
        fs::write(
            &todos_default,
            "---\nname: Todos\n---\n\n- [ ] Welcome to TrackMe — check this off to try it out\n",
        )?;
    }

    let project_default = root.join("projects").join("trackme.md");
    if !project_default.exists() {
        fs::write(
            &project_default,
            "---\n\
name: TrackMe\n\
description: My personal all-in-one workspace\n\
columns:\n  - Backlog\n  - To Do\n  - In Progress\n  - Done\n\
tasks:\n  - id: seed-1\n    title: Sketch the Projects section\n    description: A Kanban board per project, built for solo work\n    status: Done\n    createdAt: null\n    doneAt: null\n  - id: seed-2\n    title: Add drag-and-drop between columns\n    status: In Progress\n    createdAt: null\n    doneAt: null\n  - id: seed-3\n    title: Polish empty states\n    status: To Do\n    createdAt: null\n    doneAt: null\n\
---\n\n",
        )?;
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
