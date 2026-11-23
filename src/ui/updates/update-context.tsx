import Constants from "expo-constants";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Linking } from "react-native";
import { AsyncStorageStore } from "../data/async-storage-store";
import { installUpdate, isBusy, type InstallState } from "./install-update";
import { useSettings } from "../settings/settings-context";
import { checkForUpdate, dismissUpdate, storedUpdateStatus, type UpdateStatus } from "./updates";
import { CAN_INSTALL_IN_APP, clearUpdateFiles, nativeInstallPorts } from "./updates-native";

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
  /** Where the in-app update is: downloading, installing or failed. */
  install: InstallState;
  /** Downloads the update into the app's cache and opens the installer (or the browser where that is not possible). */
  installNow: () => void;
  /** Stops a download under way; the update goes back to "idle" and the file is deleted. */
  cancelInstall: () => void;
  /** Opens the release's download in the browser: the fallback when installing in the app fails. */
  openInBrowser: () => void;
  /** False where the app cannot install an APK itself (iOS), so the button says "Download". */
  canInstallInApp: boolean;
}

const UpdateContext = createContext<UpdateContextValue | null>(null);

/** Checks for a newer release on start and when the app returns to the foreground (at most daily). */
export function UpdateProvider({ children }: { children: ReactNode }) {
  const { settings, loaded } = useSettings();
  const [status, setStatus] = useState<UpdateStatus>({ kind: "unknown" });
  const [checking, setChecking] = useState(false);
  const [foregrounded, setForegrounded] = useState(0);
  const [install, setInstallState] = useState<InstallState>({ kind: "idle" });
  const installRef = useRef(install);
  const cancelRef = useRef<AbortController | null>(null);
  const setInstall = useCallback((state: InstallState) => {
    installRef.current = state;
    setInstallState(state);
  }, []);

  // Leftovers of an earlier update (a cancelled install, or the version that just replaced us).
  useEffect(() => {
    if (CAN_INSTALL_IN_APP) clearUpdateFiles();
  }, []);

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
    if (status.kind !== "available" || isBusy(installRef.current)) return;
    setInstall({ kind: "idle" });
    setStatus({ ...status, dismissed: true });
    dismissUpdate(store, status.release.version).catch(() => {});
  }, [status, setInstall]);

  const openInBrowser = useCallback(() => {
    if (status.kind !== "available") return;
    Linking.openURL(status.release.apkUrl ?? status.release.url).catch(() => {});
  }, [status]);

  const installNow = useCallback(() => {
    if (status.kind !== "available" || isBusy(installRef.current)) return;
    if (!CAN_INSTALL_IN_APP) {
      openInBrowser();
      return;
    }
    const controller = new AbortController();
    cancelRef.current = controller;
    installUpdate(status.release, nativeInstallPorts, setInstall, { signal: controller.signal })
      .catch(() => {})
      .finally(() => {
        if (cancelRef.current === controller) cancelRef.current = null;
      });
  }, [status, openInBrowser, setInstall]);

  const cancelInstall = useCallback(() => {
    cancelRef.current?.abort();
  }, []);

  const checkNow = useCallback(() => {
    run(true).catch(() => {});
  }, [run]);

  const value = useMemo(
    () => ({
      status,
      checking,
      checkNow,
      dismiss,
      install,
      installNow,
      cancelInstall,
      openInBrowser,
      canInstallInApp: CAN_INSTALL_IN_APP,
    }),
    [status, checking, checkNow, dismiss, install, installNow, cancelInstall, openInBrowser],
  );
  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdate(): UpdateContextValue {
  const value = useContext(UpdateContext);
  if (!value) throw new Error("useUpdate must be used inside UpdateProvider");
  return value;
}
