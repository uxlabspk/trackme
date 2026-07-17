const LAST_VAULT_KEY = "trackme.lastVaultPath";
const VAULTS_KEY = "trackme.vaults";
const ACTIVE_VAULT_KEY = "trackme.activeVaultPath";

/* ── Legacy single-vault helpers ── */

export function getLastVaultPath(): string | null {
  return localStorage.getItem(LAST_VAULT_KEY);
}

export function setLastVaultPath(path: string): void {
  localStorage.setItem(LAST_VAULT_KEY, path);
}

export function clearLastVaultPath(): void {
  localStorage.removeItem(LAST_VAULT_KEY);
}

/* ── Multi-vault helpers ── */

export function getVaults(): string[] {
  const raw = localStorage.getItem(VAULTS_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

export function addVault(path: string): void {
  const vaults = getVaults();
  if (!vaults.includes(path)) {
    vaults.push(path);
    localStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));
  }
}

export function removeVault(path: string): void {
  const vaults = getVaults().filter((v) => v !== path);
  localStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));
}

export function getLastActiveVault(): string | null {
  const active = localStorage.getItem(ACTIVE_VAULT_KEY);
  if (active) return active;
  const vaults = getVaults();
  return vaults.length > 0 ? vaults[0] : null;
}

export function setLastActiveVault(path: string): void {
  localStorage.setItem(ACTIVE_VAULT_KEY, path);
  addVault(path);
}

/**
 * Migrate from legacy single-vault storage to multi-vault.
 * Called once on app startup.
 */
export function migrateVaultConfig(): void {
  const vaults = getVaults();
  if (vaults.length > 0) return;

  const legacy = getLastVaultPath();
  if (legacy) {
    localStorage.setItem(VAULTS_KEY, JSON.stringify([legacy]));
    localStorage.setItem(ACTIVE_VAULT_KEY, legacy);
  }
}
