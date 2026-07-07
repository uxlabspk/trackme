import { useEffect, useState } from "react";
import Welcome from "./views/Welcome";
import VaultPicker from "./views/VaultPicker";
import MainShell from "./views/MainShell";
import { getLastVaultPath } from "./lib/appConfig";
import { bootstrapVault } from "./lib/bridge";

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

  if (screen === "welcome") {
    return <Welcome onGetStarted={() => setScreen("vault-picker")} />;
  }

  if (screen === "vault-picker") {
    return (
      <VaultPicker
        onVaultReady={(path) => {
          setVaultPath(path);
          setScreen("main");
        }}
      />
    );
  }

  if (screen === "main" && vaultPath) {
    return (
      <MainShell
        vaultPath={vaultPath}
        onSwitchVault={() => setScreen("vault-picker")}
      />
    );
  }

  return null;
}
