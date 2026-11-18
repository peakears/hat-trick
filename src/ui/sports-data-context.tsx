import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { NhlAdapter } from "../adapters/nhl";
import { SportsData } from "../data";
import type { LeagueId } from "../domain";
import { AdapterRegistry } from "../registry";
import { AsyncStorageStore } from "./async-storage-store";

/** The league the app shows. Only the NHL exists so far; a league picker comes with the second league. */
export const LEAGUE: LeagueId = "nhl";

function createSportsData(): SportsData {
  const registry = new AdapterRegistry();
  registry.register(new NhlAdapter());
  return new SportsData({ registry, store: new AsyncStorageStore() });
}

const SportsDataContext = createContext<SportsData | null>(null);

export function SportsDataProvider({ children }: { children: ReactNode }) {
  const [data] = useState(createSportsData);

  useEffect(() => {
    // Drop long-stale entries on start so the cache does not grow forever.
    data.prune().catch(() => {});
  }, [data]);

  return <SportsDataContext.Provider value={data}>{children}</SportsDataContext.Provider>;
}

export function useSportsData(): SportsData {
  const data = useContext(SportsDataContext);
  if (!data) throw new Error("useSportsData must be used inside SportsDataProvider");
  return data;
}
