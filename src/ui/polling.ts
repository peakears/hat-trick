// When the UI should ask SportsData again. Pure (no React Native imports), so it is unit tested.
// The TTLs themselves live in src/data/freshness.ts; this only turns meta.staleAt into a timer.

import type { DataMeta, Fetched } from "../data";

export const POLL = {
  /** Never poll faster than this, even if staleAt is already close. */
  minDelay: 1_000,
  /** Wake up at least this often. Re-reading fresh cache is cheap, and long timers are unreliable on Android. */
  maxDelay: 10 * 60_000,
  /** After a failed refresh (offline, API down), try again after this long. */
  retry: 30_000,
  /** Poll slightly after staleAt, so the cache entry is stale when we ask. */
  margin: 500,
} as const;

/** A manual refresh (pull down) is ignored while the data on screen is newer than this. */
export const REFRESH_COOLDOWN_MS = 30_000;

/**
 * Whether a pull-to-refresh should go to the network. Not when data from the last 30 seconds is on
 * screen (a live game refreshes itself every 20 seconds anyway). Always when nothing loaded yet, when
 * the data is an offline fallback, or when it is old, so Retry after an error is never blocked.
 */
export function canManualRefresh(meta: DataMeta | undefined, now: number): boolean {
  if (!meta || meta.error || meta.stale) return true;
  return now - Date.parse(meta.fetchedAt) >= REFRESH_COOLDOWN_MS;
}

/** Milliseconds until the next poll. `meta` is undefined when the last request failed with nothing cached. */
export function nextPollDelay(meta: DataMeta | undefined, now: number): number {
  if (!meta || meta.error || meta.stale) return POLL.retry;
  const untilStale = Date.parse(meta.staleAt) - now + POLL.margin;
  return Math.min(POLL.maxDelay, Math.max(POLL.minDelay, untilStale));
}

/**
 * Merges several results shown together on one screen (e.g. one leader board per goalie category)
 * into one, whose meta is as urgent as the most urgent part.
 */
export function combineFetched<T>(results: Fetched<T>[]): Fetched<T[]> {
  if (results.length === 0) throw new Error("combineFetched needs at least one result");
  const metas = results.map((r) => r.meta);
  const earliest = (values: string[]) => values.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
  return {
    data: results.map((r) => r.data),
    meta: {
      league: metas[0].league,
      key: metas.map((m) => m.key).join("+"),
      source: metas.some((m) => m.source === "network") ? "network" : "cache",
      fetchedAt: earliest(metas.map((m) => m.fetchedAt)),
      staleAt: earliest(metas.map((m) => m.staleAt)),
      stale: metas.some((m) => m.stale),
      warnings: metas.flatMap((m) => m.warnings),
      error: metas.find((m) => m.error)?.error,
    },
  };
}
