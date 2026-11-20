import * as SplashScreen from "expo-splash-screen";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance } from "react-native";
import { AsyncStorageStore } from "./async-storage-store";
import { DEFAULT_SETTINGS, colorSchemeOverride, loadSettings, saveSettings, type Settings } from "./settings";

// Keep the splash screen up until the stored theme is applied, so a dark-theme user never sees a light flash.
SplashScreen.preventAutoHideAsync().catch(() => {});

const store = new AsyncStorageStore();

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    loadSettings(store)
      .then((loaded) => {
        if (!active) return;
        Appearance.setColorScheme(colorSchemeOverride(loaded.theme));
        setSettings(loaded);
      })
      .finally(() => SplashScreen.hideAsync().catch(() => {}));
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch };
      if (next.theme !== settings.theme) Appearance.setColorScheme(colorSchemeOverride(next.theme));
      setSettings(next);
      saveSettings(store, next).catch(() => {});
    },
    [settings],
  );

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsProvider");
  return value;
}
