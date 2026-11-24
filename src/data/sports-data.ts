// The on-device data layer: the only thing the UI calls.
// adapters -> domain model -> SportsData (cache + metadata) -> UI
//
// - Fresh cached data is returned without a network call.
// - Stale or missing data is fetched; the result is cached with a TTL based on game status.
// - If a fetch fails and anything is cached, the last known data is returned, marked stale.
// - Concurrent requests for the same key share one network call.

import type {
  Game,
  GameDetail,
  GamePlays,
  LeaderBoard,
  LeaderQuery,
  LeagueAdapter,
  LeagueFeature,
  LeaderGroup,
  LeagueId,
  RequestOptions,
  Standings,
  PlayerDetail,
  TeamDetail,
  SpecialEvents,
  SpotlightEntry,
} from "../domain";
import { adapterSupports } from "../domain";
import type { AdapterRegistry } from "../registry";
import { FRESHNESS, gameDetailFreshness, gameFreshness, scoresFreshness, teamFreshness } from "./freshness";
import type { DiagnosticsLog, NewLogEntry } from "./diagnostics";
import type { KeyValueStore } from "./store";
import type { DataMeta, Fetched, FetchOptions } from "./types";

/** Bump when the shape of cached domain data changes, so old entries are ignored. */
export const CACHE_VERSION = 16;

/** Storage keys are prefixed so the cache can share a store with app settings. */
const PREFIX = "cache:";

interface CacheEntry<T> {
  v: number;
  data: T;
  fetchedAt: number;
  staleAt: number;
  warnings: string[];
}

/** A call for a feature the league's adapter does not have (LeagueFeature). */
export class UnsupportedFeatureError extends Error {
  constructor(
    readonly league: LeagueId,
    readonly feature: LeagueFeature,
  ) {
    super(`${league} has no ${feature}`);
    this.name = "UnsupportedFeatureError";
  }
}

export interface SportsDataOptions {
  registry: AdapterRegistry;
  store: KeyValueStore;
  /** Injectable clock for tests. */
  now?: () => number;
  /** Receives every adapter warning and failed request (Settings › Diagnostics). */
  log?: DiagnosticsLog;
}

interface Resource<T> {
  league: LeagueId;
  key: string;
  load: (options: RequestOptions) => Promise<T>;
  freshFor: (data: T, now: number) => number;
}

export class SportsData {
  private readonly registry: AdapterRegistry;
  private readonly store: KeyValueStore;
  private readonly now: () => number;
  private readonly log?: DiagnosticsLog;
  private readonly inFlight = new Map<string, Promise<Fetched<unknown>>>();

  constructor(options: SportsDataOptions) {
    this.registry = options.registry;
    this.store = options.store;
    this.now = options.now ?? Date.now;
    this.log = options.log;
  }

  getScores(league: LeagueId, date: string, options?: FetchOptions): Promise<Fetched<Game[]>> {
    return this.get(
      {
        league,
        key: `${league}:scores:${date}`,
        load: (o) => this.registry.get(league).getScores(date, o),
        freshFor: scoresFreshness,
      },
      options,
    );
  }

  getStandings(league: LeagueId, options?: FetchOptions): Promise<Fetched<Standings>> {
    return this.get(
      {
        league,
        key: `${league}:standings`,
        load: (o) => this.registry.get(league).getStandings(o),
        freshFor: () => FRESHNESS.standings,
      },
      options,
    );
  }

  getLeaders(league: LeagueId, query: LeaderQuery = {}, options?: FetchOptions): Promise<Fetched<LeaderBoard[]>> {
    const category = query.category ?? "default";
    const limit = query.limit ?? "default";
    return this.get(
      {
        league,
        key: `${league}:leaders:${category}:${limit}`,
        load: (o) => this.registry.get(league).getLeaders(query, o),
        freshFor: () => FRESHNESS.leaders,
      },
      options,
    );
  }

  /** Special event names for the week starting on `weekStart`, by game id; empty for a league without them. */
  async getSpecialEvents(league: LeagueId, weekStart: string, options?: FetchOptions): Promise<Fetched<SpecialEvents>> {
    const key = `${league}:events:${weekStart}`;
    // A league without them has none: an empty answer, fresh as long as a real one, so Scores needs no special case.
    if (!this.supports(league, "specialEvents")) {
      const now = this.now();
      const meta = {
        league,
        key,
        source: "cache" as const,
        fetchedAt: new Date(now).toISOString(),
        staleAt: new Date(now + FRESHNESS.specialEvents).toISOString(),
        stale: false,
        warnings: [],
      };
      return { data: {}, meta };
    }
    const adapter = this.optional(league, "specialEvents");
    return this.get(
      {
        league,
        key,
        load: (o) => adapter.getSpecialEvents!(weekStart, o),
        freshFor: () => FRESHNESS.specialEvents,
      },
      options,
    );
  }

  async getSpotlight(league: LeagueId, options?: FetchOptions): Promise<Fetched<SpotlightEntry[]>> {
    const adapter = this.optional(league, "spotlight");
    return this.get(
      {
        league,
        key: `${league}:spotlight`,
        load: (o) => adapter.getSpotlight!(o),
        freshFor: () => FRESHNESS.spotlight,
      },
      options,
    );
  }

  async getGameDetail(league: LeagueId, gameId: string, options?: FetchOptions): Promise<Fetched<GameDetail>> {
    const adapter = this.optional(league, "gameDetail");
    return this.get(
      {
        league,
        key: `${league}:game:${gameId}`,
        load: (o) => adapter.getGameDetail!(gameId, o),
        freshFor: (detail, now) => gameDetailFreshness(detail, now),
      },
      options,
    );
  }

  /**
   * A game's plays, under a key of their own: the play-by-play is large, so it is only fetched while its screen is
   * open, not with every poll of the game page. As fresh as the game itself.
   */
  async getPlays(league: LeagueId, gameId: string, options?: FetchOptions): Promise<Fetched<GamePlays>> {
    const adapter = this.optional(league, "plays");
    return this.get(
      {
        league,
        key: `${league}:plays:${gameId}`,
        load: (o) => adapter.getPlays!(gameId, o),
        freshFor: (plays, now) => gameFreshness(plays.game, now),
      },
      options,
    );
  }

  async getTeam(league: LeagueId, teamId: string, options?: FetchOptions): Promise<Fetched<TeamDetail>> {
    const adapter = this.optional(league, "team");
    return this.get(
      {
        league,
        key: `${league}:team:${teamId}`,
        load: (o) => adapter.getTeam!(teamId, o),
        freshFor: (detail, now) => teamFreshness(detail, now),
      },
      options,
    );
  }

  async getPlayer(league: LeagueId, playerId: string, options?: FetchOptions): Promise<Fetched<PlayerDetail>> {
    const adapter = this.optional(league, "player");
    return this.get(
      {
        league,
        key: `${league}:player:${playerId}`,
        load: (o) => adapter.getPlayer!(playerId, o),
        freshFor: () => FRESHNESS.player,
      },
      options,
    );
  }

  /** How the Leaders tab groups `league`'s boards: the adapter's groups, else one group of the default boards. */
  leaderGroups(league: LeagueId): readonly LeaderGroup[] {
    return this.registry.get(league).leaderGroups ?? [{ id: "leaders", label: "Leaders" }];
  }

  /** The league's full name ("National Hockey League"), for the league menu. */
  leagueName(league: LeagueId): string {
    return this.registry.get(league).name;
  }

  /** The leagues the app has, in the order they were registered. */
  leagues(): LeagueId[] {
    return this.registry.leagues();
  }

  /** Whether `league` has `feature` (game pages, team pages, ...); the UI hides what leads to one it lacks. */
  supports(league: LeagueId, feature: LeagueFeature): boolean {
    return adapterSupports(this.registry.get(league), feature);
  }

  /**
   * The adapter, when it has `feature`. Otherwise UnsupportedFeatureError, before any request or cache read, so a
   * screen that should not have been reachable fails plainly and nothing reaches the diagnostics log.
   */
  private optional(league: LeagueId, feature: LeagueFeature): LeagueAdapter {
    const adapter = this.registry.get(league);
    if (!adapterSupports(adapter, feature)) throw new UnsupportedFeatureError(league, feature);
    return adapter;
  }

  /**
   * Removes cache entries that have been stale for longer than `olderThanMs`
   * (default 30 days), plus entries from an old CACHE_VERSION. Call on app start.
   */
  async prune(olderThanMs = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = this.now() - olderThanMs;
    let removed = 0;
    for (const storeKey of await this.store.keys()) {
      if (!storeKey.startsWith(PREFIX)) continue;
      const key = storeKey.slice(PREFIX.length);
      const entry = await this.read(key);
      if (!entry || entry.staleAt < cutoff) {
        await this.store.delete(storeKey);
        removed++;
      }
    }
    return removed;
  }

  // ---------- Internals ----------

  private async get<T>(resource: Resource<T>, options: FetchOptions = {}): Promise<Fetched<T>> {
    const cached = await this.read<T>(resource.key);
    if (cached && !options.force && this.now() < cached.staleAt) {
      return { data: cached.data, meta: this.meta(resource, cached, "cache") };
    }

    // Share one network call between concurrent callers for the same key.
    const pending = this.inFlight.get(resource.key) as Promise<Fetched<T>> | undefined;
    if (pending) return pending;

    const request = this.refresh(resource, cached).finally(() => {
      this.inFlight.delete(resource.key);
    });
    this.inFlight.set(resource.key, request);
    return request;
  }

  private async refresh<T>(resource: Resource<T>, cached: CacheEntry<T> | null): Promise<Fetched<T>> {
    const warnings: string[] = [];
    const { league, key } = resource;
    let data: T;
    try {
      data = await resource.load({
        onWarning: (w) => {
          warnings.push(w.message);
          this.record({ kind: "warning", league, key, url: w.url, message: w.message });
        },
      });
    } catch (err) {
      this.record({ kind: "error", league, key, url: (err as { url?: string }).url, message: errorText(err) });
      if (!cached) throw err;
      // Offline or API down: show the last known data, flagged as stale.
      return {
        data: cached.data,
        meta: { ...this.meta(resource, cached, "cache"), error: (err as Error).message },
      };
    }

    const fetchedAt = this.now();
    const entry: CacheEntry<T> = {
      v: CACHE_VERSION,
      data,
      fetchedAt,
      staleAt: fetchedAt + resource.freshFor(data, fetchedAt),
      warnings,
    };
    try {
      await this.store.set(PREFIX + resource.key, JSON.stringify(entry));
    } catch {
      // Storage full or unavailable: still return the fresh data.
    }
    return { data, meta: this.meta(resource, entry, "network") };
  }

  /** Logs a problem without waiting for the write, so loading data is never slowed or broken by the log. */
  private record(entry: NewLogEntry): void {
    this.log?.record(entry).catch(() => {});
  }

  private async read<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const text = await this.store.get(PREFIX + key);
      if (!text) return null;
      const entry = JSON.parse(text) as CacheEntry<T>;
      if (entry?.v !== CACHE_VERSION || typeof entry.staleAt !== "number") return null;
      return entry;
    } catch {
      return null; // Corrupt entry or unreadable storage: treat as a miss.
    }
  }

  private meta<T>(resource: Resource<T>, entry: CacheEntry<T>, source: DataMeta["source"]): DataMeta {
    return {
      league: resource.league,
      key: resource.key,
      source,
      fetchedAt: new Date(entry.fetchedAt).toISOString(),
      staleAt: new Date(entry.staleAt).toISOString(),
      stale: this.now() >= entry.staleAt,
      warnings: entry.warnings,
    };
  }
}

/** "NhlApiError: HTTP 503", or the message of a thrown non-Error. */
function errorText(err: unknown): string {
  if (err instanceof Error) return err.name && err.name !== "Error" ? `${err.name}: ${err.message}` : err.message;
  return String(err);
}
