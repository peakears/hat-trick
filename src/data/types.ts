import type { LeagueId } from "../domain";

/** Where a result came from. */
export type DataSource = "network" | "cache";

/** Metadata the UI and polling need about every result. */
export interface DataMeta {
  league: LeagueId;
  /** Cache key, e.g. "nhl:scores:2026-11-17". */
  key: string;
  source: DataSource;
  /** When the data was fetched from the league API (ISO 8601). */
  fetchedAt: string;
  /** When the data should be refetched (ISO 8601). Poll at about this time. */
  staleAt: string;
  /** True when staleAt has passed: shown because a refresh failed or was not attempted. */
  stale: boolean;
  /** Minor problems the adapter worked around when this data was fetched. */
  warnings: string[];
  /** Set when a refresh failed and cached data was returned instead. */
  error?: string;
}

export interface Fetched<T> {
  data: T;
  meta: DataMeta;
}

export interface FetchOptions {
  /** Skip the cache and fetch now (e.g. pull-to-refresh). Falls back to the cache if the fetch fails. */
  force?: boolean;
}
