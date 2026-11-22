import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { NhlAdapter } from "../adapters/nhl";
import { DiagnosticsLog, SportsData } from "../data";
import type { LeagueId } from "../domain";
import { AdapterRegistry } from "../registry";
import { AsyncStorageStore } from "./async-storage-store";

/** The league the app shows. Only the NHL exists so far; a league picker comes with the second league. */
export const LEAGUE: LeagueId = "nhl";

interface Services {
  data: SportsData;
  log: DiagnosticsLog;
}

function createServices(): Services {
  const registry = new AdapterRegistry();
  registry.register(new NhlAdapter());
  const store = new AsyncStorageStore();
  const log = new DiagnosticsLog(store);
  return { data: new SportsData({ registry, store, log }), log };
}

const SportsDataContext = createContext<Services | null>(null);

export function SportsDataProvider({ children }: { children: ReactNode }) {
  const [services] = useState(createServices);
  const { data } = services;

  useEffect(() => {
    // Drop long-stale entries on start so the cache does not grow forever.
    data.prune().catch(() => {});
  }, [data]);

  return <SportsDataContext.Provider value={services}>{children}</SportsDataContext.Provider>;
}

function useServices(): Services {
  const services = useContext(SportsDataContext);
  if (!services) throw new Error("useSportsData must be used inside SportsDataProvider");
  return services;
}

export function useSportsData(): SportsData {
  return useServices().data;
}

/** The diagnostics log (Settings › Diagnostics). */
export function useDiagnosticsLog(): DiagnosticsLog {
  return useServices().log;
}
