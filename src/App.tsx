import { useEffect, useState } from "react";
import Welcome from "./views/Welcome";
import VaultPicker from "./views/VaultPicker";
import MainShell from "./views/MainShell";
import { getLastVaultPath } from "./lib/appConfig";
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
    const last = getLastVaultPath();
    if (last) {
      bootstrapVault(last)
        .then(() => {
          setVaultPathState(last);
          setScreen("main");
          initNotifications(last);
        })
        .catch(() => setScreen("welcome"));
    } else {
      setScreen("welcome");
    }
  }, []);

  if (screen === "loading") {
    return <div style={{ height: "100%", background: "var(--paper)" }} />;
  }

  return (
    <ThemeProvider>
      {screen === "welcome" && <Welcome onGetStarted={() => setScreen("vault-picker")} />}
      {screen === "vault-picker" && (
        <VaultPicker
          onVaultReady={(path) => {
            setVaultPathState(path);
            setScreen("main");
            initNotifications(path);
          }}
        />
      )}
      {screen === "main" && vaultPath && (
        <MainShell
          vaultPath={vaultPath}
          onSwitchVault={() => setScreen("vault-picker")}
        />
      )}
    </ThemeProvider>
  );
}
