import Constants from "expo-constants";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { AsyncStorageStore } from "./async-storage-store";
import { useSettings } from "./settings-context";
import { checkForUpdate, dismissUpdate, storedUpdateStatus, type UpdateStatus } from "./updates";

const store = new AsyncStorageStore();

/** The running version, from app.config.ts (which reads package.json). */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "0.0.0";

interface UpdateContextValue {
  status: UpdateStatus;
  /** True while a check is running. */
  checking: boolean;
  /** The "Check for updates" button: skips the once-a-day limit, and works even if automatic checks are off. */
  checkNow: () => void;
  /** Closes the banner for the version on offer. */
  dismiss: () => void;
}

const UpdateContext = createContext<UpdateContextValue | null>(null);

/** Checks for a newer release on start and when the app returns to the foreground (at most daily). */
export function UpdateProvider({ children }: { children: ReactNode }) {
  const { settings, loaded } = useSettings();
  const [status, setStatus] = useState<UpdateStatus>({ kind: "unknown" });
  const [checking, setChecking] = useState(false);
  const [foregrounded, setForegrounded] = useState(0);

  const run = useCallback(async (force: boolean) => {
    setChecking(true);
    try {
      setStatus(await checkForUpdate({ currentVersion: APP_VERSION, store, fetchFn: fetch, now: Date.now(), force }));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setForegrounded((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  const auto = loaded && settings.checkForUpdates;
  useEffect(() => {
    if (!auto) {
      // Show what an earlier check found, without contacting GitHub.
      storedUpdateStatus(store, APP_VERSION)
        .then(setStatus)
        .catch(() => {});
      return;
    }
    run(false).catch(() => {});
  }, [auto, foregrounded, run]);

  const dismiss = useCallback(() => {
    if (status.kind !== "available") return;
    setStatus({ ...status, dismissed: true });
    dismissUpdate(store, status.release.version).catch(() => {});
  }, [status]);

  const checkNow = useCallback(() => {
    run(true).catch(() => {});
  }, [run]);

  const value = useMemo(() => ({ status, checking, checkNow, dismiss }), [status, checking, checkNow, dismiss]);
  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdate(): UpdateContextValue {
  const value = useContext(UpdateContext);
  if (!value) throw new Error("useUpdate must be used inside UpdateProvider");
  return value;
}
