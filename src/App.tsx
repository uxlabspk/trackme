import { useEffect, useState } from "react";
import Welcome from "./views/Welcome";
import VaultPicker from "./views/VaultPicker";
import MainShell from "./views/MainShell";
import { getLastVaultPath } from "./lib/appConfig";
import { bootstrapVault } from "./lib/bridge";
import { ThemeProvider } from "./lib/ThemeContext";

type Screen = "loading" | "welcome" | "vault-picker" | "main";

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [vaultPath, setVaultPath] = useState<string | null>(null);

  useEffect(() => {
    const last = getLastVaultPath();
    if (last) {
      bootstrapVault(last)
        .then(() => {
          setVaultPath(last);
          setScreen("main");
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
            setVaultPath(path);
            setScreen("main");
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
