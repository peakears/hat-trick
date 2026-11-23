import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { NhlAdapter } from "../../adapters/nhl";
import { DiagnosticsLog, SportsData } from "../../data";
import type { LeagueId } from "../../domain";
import { AdapterRegistry } from "../../registry";
import { AsyncStorageStore } from "./async-storage-store";

/** The league the app shows. Only the NHL exists so far; a league picker comes with the second league. */
export const LEAGUE: LeagueId = "nhl";

export interface Services {
  data: SportsData;
  log: DiagnosticsLog;
  store: AsyncStorageStore;
}

let services: Services | undefined;

/**
 * The app's one SportsData, diagnostics log and store, created on first use. Shared with the live score service
 * (live-tracker-run.ts), which runs outside React while the app is closed, so both use the same cache.
 */
export function getServices(): Services {
  if (!services) {
    const registry = new AdapterRegistry();
    registry.register(new NhlAdapter());
    const store = new AsyncStorageStore();
    const log = new DiagnosticsLog(store);
    services = { data: new SportsData({ registry, store, log }), log, store };
  }
  return services;
}

const SportsDataContext = createContext<Services | null>(null);

export function SportsDataProvider({ children }: { children: ReactNode }) {
  const [value] = useState(getServices);
  const { data } = value;

  useEffect(() => {
    // Drop long-stale entries on start so the cache does not grow forever.
    data.prune().catch(() => {});
  }, [data]);

  return <SportsDataContext.Provider value={value}>{children}</SportsDataContext.Provider>;
}

function useServices(): Services {
  const value = useContext(SportsDataContext);
  if (!value) throw new Error("useSportsData must be used inside SportsDataProvider");
  return value;
}

export function useSportsData(): SportsData {
  return useServices().data;
}

/** The diagnostics log (Settings › Diagnostics). */
export function useDiagnosticsLog(): DiagnosticsLog {
  return useServices().log;
}
