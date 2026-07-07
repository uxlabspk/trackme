const LAST_VAULT_KEY = "trackme.lastVaultPath";

export function getLastVaultPath(): string | null {
  return localStorage.getItem(LAST_VAULT_KEY);
}

export function setLastVaultPath(path: string): void {
  localStorage.setItem(LAST_VAULT_KEY, path);
}

export function clearLastVaultPath(): void {
  localStorage.removeItem(LAST_VAULT_KEY);
}
