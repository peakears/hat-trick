import type { z } from "zod";
import type {
  AdapterWarning,
  Game,
  GameDetail,
  LeaderBoard,
  LeaderQuery,
  LeagueAdapter,
  RequestOptions,
  Standings,
  TeamDetail,
} from "../../domain";
import { NflClient, type NflClientOptions } from "./client";
import {
  DEFAULT_LEADER_LIMIT,
  LEADER_CATEGORIES,
  LEADER_GROUPS,
  LEADERS_URL,
  LEAGUE,
  QUARTERS,
  SITE_URL,
  STANDINGS_URL,
} from "./constants";
import { mapLeaderBoard, mapScoreboard, mapStandings, mapSummary, mapTeamSchedule, mapTeamStats } from "./mappers";
import {
  RawLeadersSchema,
  RawScoreboardSchema,
  RawStandingsSchema,
  RawSummarySchema,
  RawTeamScheduleSchema,
  RawTeamStatsSchema,
} from "./raw-types";
import { parseResponse } from "./validate";

export interface NflAdapterOptions extends NflClientOptions {
  /** Called for each minor field the API returned in an unexpected shape. Defaults to console.warn. */
  onWarning?: (warning: AdapterWarning) => void;
  /** Injectable clock for tests (the standings' updatedAt). */
  now?: () => Date;
}

/**
 * The NFL from ESPN's keyless site API: scores, standings, leaders, and game and team pages. The other optional
 * features (player pages, play-by-play) are left out until they are built, so the app hides what leads there.
 */
export class NflAdapter implements LeagueAdapter {
  readonly league = LEAGUE;
  readonly name = "National Football League";
  readonly gameStartTerm = "Kickoff";
  // Each score needs the game page's scoring plays, not built yet: late lead changes, overtime and the final instead.
  readonly liveAlerts = { kind: "lateLeadChanges", regulationPeriods: QUARTERS } as const;
  readonly leaderGroups = LEADER_GROUPS;

  private readonly client: NflClient;
  private readonly onWarning: (warning: AdapterWarning) => void;
  private readonly now: () => Date;

  constructor(options: NflAdapterOptions = {}) {
    this.client = new NflClient(options);
    this.onWarning = options.onWarning ?? ((w) => console.warn(`[nfl] ${w.message} (${w.url})`));
    this.now = options.now ?? (() => new Date());
  }

  private async fetch<T extends z.ZodType>(url: string, schema: T, options: RequestOptions = {}): Promise<z.output<T>> {
    const data = await this.client.get(url);
    return parseResponse(schema, data, url, options.onWarning ?? this.onWarning);
  }

  /** `date` is the league's calendar date (US Eastern), like the NHL's: a game at 8:20 pm ET is on that day. */
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
    if (categories.length === 0) throw new Error(`Unknown NFL leader category: ${query.category}`);
    return Promise.all(
      categories.map(async ({ category, label, decimals }) => {
        const url = `${LEADERS_URL}?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=${limit}&sort=${category}:desc`;
        return mapLeaderBoard(await this.fetch(url, RawLeadersSchema, options), category, label, limit, decimals);
      }),
    );
  }

  /** The score card, box score, team stats, top performers and scoring plays, from the game's summary (one request). */
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
    return { teamId, stats: mapTeamStats(stats, teamId), ...schedule };
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
      // A best-effort extra: the page shows without it, and the failure is passed on as a warning.
      const reason = err instanceof Error ? err.message : String(err);
      (options?.onWarning ?? this.onWarning)({ url, message: `team games left out: ${reason}` });
      return {};
    }
  }
}
