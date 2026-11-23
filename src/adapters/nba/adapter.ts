import type { z } from "zod";
import type {
  AdapterWarning,
  Game,
  GameDetail,
  LeaderBoard,
  LeaderQuery,
  LeagueAdapter,
  PlayerDetail,
  RequestOptions,
  Standings,
  TeamDetail,
} from "../../domain";
import { NbaClient, type NbaClientOptions } from "./client";
import {
  ATHLETES_URL,
  DEFAULT_LEADER_LIMIT,
  LEADER_CATEGORIES,
  LEADERS_URL,
  LEAGUE,
  SITE_URL,
  STANDINGS_URL,
} from "./constants";
import {
  hasPlayoffStats,
  mapLeaderBoard,
  mapPlayer,
  mapScoreboard,
  mapStandings,
  mapSummary,
  mapTeamSchedule,
  mapTeamStats,
} from "./mappers";
import {
  RawAthleteSchema,
  RawAthleteStatsSchema,
  RawGamelogSchema,
  RawLeadersSchema,
  RawScoreboardSchema,
  RawStandingsSchema,
  RawSummarySchema,
  RawTeamScheduleSchema,
  RawTeamStatsSchema,
} from "./raw-types";
import { parseResponse } from "./validate";

export interface NbaAdapterOptions extends NbaClientOptions {
  /** Called for each minor field the API returned in an unexpected shape. Defaults to console.warn. */
  onWarning?: (warning: AdapterWarning) => void;
  /** Injectable clock for tests (the standings' updatedAt). */
  now?: () => Date;
}

/**
 * The NBA from ESPN's keyless site API: scores, standings, leaders, and game, team and player pages. The other
 * optional features (special events, spotlight) are left out until they are built, so the app hides what leads there.
 */
export class NbaAdapter implements LeagueAdapter {
  readonly league = LEAGUE;

  private readonly client: NbaClient;
  private readonly onWarning: (warning: AdapterWarning) => void;
  private readonly now: () => Date;

  constructor(options: NbaAdapterOptions = {}) {
    this.client = new NbaClient(options);
    this.onWarning = options.onWarning ?? ((w) => console.warn(`[nba] ${w.message} (${w.url})`));
    this.now = options.now ?? (() => new Date());
  }

  private async fetch<T extends z.ZodType>(url: string, schema: T, options: RequestOptions = {}): Promise<z.output<T>> {
    const data = await this.client.get(url);
    return parseResponse(schema, data, url, options.onWarning ?? this.onWarning);
  }

  /** `date` is the league's calendar date (US Eastern), like the NHL's. */
  async getScores(date: string, options?: RequestOptions): Promise<Game[]> {
    const raw = await this.fetch(
      `${SITE_URL}/scoreboard?dates=${date.replaceAll("-", "")}`,
      RawScoreboardSchema,
      options,
    );
    return mapScoreboard(raw);
  }

  async getStandings(options?: RequestOptions): Promise<Standings> {
    // level=3: conferences, then divisions (without it, conferences only).
    const raw = await this.fetch(`${STANDINGS_URL}?level=3`, RawStandingsSchema, options);
    return mapStandings(raw, this.now());
  }

  /** One request per board: the default query asks for every board in LEADER_CATEGORIES. */
  async getLeaders(query: LeaderQuery = {}, options?: RequestOptions): Promise<LeaderBoard[]> {
    const limit = query.limit ?? DEFAULT_LEADER_LIMIT;
    const categories = query.category
      ? LEADER_CATEGORIES.filter((c) => c.category === query.category)
      : LEADER_CATEGORIES;
    if (categories.length === 0) throw new Error(`Unknown NBA leader category: ${query.category}`);
    return Promise.all(
      categories.map(async ({ category, label }) => {
        const url = `${LEADERS_URL}?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=${limit}&sort=${category}:desc`;
        return mapLeaderBoard(await this.fetch(url, RawLeadersSchema, options), category, label, limit);
      }),
    );
  }

  /** The score card and box score, from the game's summary (one request). */
  async getGameDetail(gameId: string, options?: RequestOptions): Promise<GameDetail> {
    const raw = await this.fetch(`${SITE_URL}/summary?event=${encodeURIComponent(gameId)}`, RawSummarySchema, options);
    return mapSummary(raw);
  }

  /** The roster's season stats, plus the team's games from its schedule (an extra: left out if it fails). */
  async getTeam(teamId: string, options?: RequestOptions): Promise<TeamDetail> {
    const team = encodeURIComponent(teamId);
    const [stats, schedule] = await Promise.all([
      this.fetch(`${SITE_URL}/teams/${team}/athletes/statistics`, RawTeamStatsSchema, options),
      this.getTeamSchedule(team, teamId, options),
    ]);
    return { teamId, stats: mapTeamStats(stats), ...schedule };
  }

  /**
   * The athlete (bio, team, this season's averages) decides whether the page loads. Season-by-season stats, the
   * playoffs and the game log are extras: each is left out, with a warning, if it fails.
   */
  async getPlayer(playerId: string, options?: RequestOptions): Promise<PlayerDetail> {
    const base = `${ATHLETES_URL}/${encodeURIComponent(playerId)}`;
    // region=us: dates come month first (see raw-types.ts).
    const query = "region=us&lang=en";
    const [athlete, regular, gamelog] = await Promise.all([
      this.fetch(`${base}?${query}`, RawAthleteSchema, options),
      this.extra(`${base}/stats?${query}`, RawAthleteStatsSchema, "season stats", options),
      this.extra(`${base}/gamelog?${query}`, RawGamelogSchema, "last games", options),
    ]);
    // Asked for only when the regular season lists playoffs: most players' answer would be the regular season again.
    const playoffs =
      regular && hasPlayoffStats(regular)
        ? await this.extra(`${base}/stats?${query}&seasontype=3`, RawAthleteStatsSchema, "playoff stats", options)
        : undefined;
    return mapPlayer(athlete, { regular, playoffs, gamelog });
  }

  /** A best-effort request: undefined, with a warning, if it fails. */
  private async extra<T extends z.ZodType>(
    url: string,
    schema: T,
    what: string,
    options?: RequestOptions,
  ): Promise<z.output<T> | undefined> {
    try {
      return await this.fetch(url, schema, options);
    } catch (err) {
      this.extraFailed(url, what, err, options);
      return undefined;
    }
  }

  /** A best-effort extra failed: the page shows without it, and the failure is passed on as a warning. */
  private extraFailed(url: string, what: string, err: unknown, options?: RequestOptions): void {
    const reason = err instanceof Error ? err.message : String(err);
    (options?.onWarning ?? this.onWarning)({ url, message: `${what} left out: ${reason}` });
  }

  private async getTeamSchedule(
    team: string,
    teamId: string,
    options?: RequestOptions,
  ): Promise<Pick<TeamDetail, "recent" | "upcoming" | "arena">> {
    const url = `${SITE_URL}/teams/${team}/schedule`;
    try {
      return mapTeamSchedule(await this.fetch(url, RawTeamScheduleSchema, options), teamId);
    } catch (err) {
      this.extraFailed(url, "team games", err, options);
      return {};
    }
  }
}
