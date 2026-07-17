import { useEffect, useState } from "react";
import Welcome from "./views/Welcome";
import VaultPicker from "./views/VaultPicker";
import MainShell from "./views/MainShell";
import { getLastVaultPath, migrateVaultConfig, getLastActiveVault, setLastActiveVault } from "./lib/appConfig";
import { bootstrapVault, setVaultPath } from "./lib/bridge";
import { ThemeProvider } from "./lib/ThemeContext";

type Screen = "loading" | "welcome" | "vault-picker" | "main";

async function initNotifications(vaultPath: string) {
  try {
    const { isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
    let granted = await isPermissionGranted();
    if (!granted) {
      const result = await requestPermission();
      granted = result === "granted";
    }
    if (granted) {
      await setVaultPath(vaultPath);
    }
  } catch {
    // Notification plugin not available, skip
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [vaultPath, setVaultPathState] = useState<string | null>(null);

  useEffect(() => {
    migrateVaultConfig();

    const active = getLastActiveVault();
    if (active) {
      bootstrapVault(active)
        .then(() => {
          setVaultPathState(active);
          setScreen("main");
          initNotifications(active);
        })
        .catch(() => setScreen("welcome"));
    } else {
      const legacy = getLastVaultPath();
      if (legacy) {
        bootstrapVault(legacy)
          .then(() => {
            setLastActiveVault(legacy);
            setVaultPathState(legacy);
            setScreen("main");
            initNotifications(legacy);
          })
          .catch(() => setScreen("welcome"));
      } else {
        setScreen("welcome");
      }
    }
  }, []);

  function handleVaultSwitch(path: string) {
    setVaultPathState(path);
    setScreen("main");
    initNotifications(path);
  }

  if (screen === "loading") {
    return <div style={{ height: "100%", background: "var(--paper)" }} />;
  }

  return (
    <ThemeProvider>
      {screen === "welcome" && <Welcome onGetStarted={() => setScreen("vault-picker")} />}
      {screen === "vault-picker" && (
        <VaultPicker
          onVaultReady={(path) => {
            setLastActiveVault(path);
            setVaultPathState(path);
            setScreen("main");
            initNotifications(path);
          }}
        />
      )}
      {screen === "main" && vaultPath && (
        <MainShell
          vaultPath={vaultPath}
          onVaultSwitch={handleVaultSwitch}
        />
      )}
    </ThemeProvider>
  );
}
