import type { z } from "zod";
import type {
  AdapterWarning,
  Game,
  GameDetail,
  Goal,
  LeaderBoard,
  LeaderQuery,
  LeagueAdapter,
  RequestOptions,
  Standings,
} from "../../domain";
import { NhlClient, type NhlClientOptions } from "./client";
import { GOALIE_LEADER_CATEGORIES, LEAGUE, SKATER_LEADER_CATEGORIES } from "./constants";
import { mapBoxscoreSide, mapGame, mapGoals, mapLeaders, mapStandings } from "./mappers";
import {
  RawBoxscoreSchema,
  RawLeadersResponseSchema,
  RawScoreResponseSchema,
  RawStandingsResponseSchema,
} from "./raw-types";
import { parseResponse } from "./validate";

export interface NhlAdapterOptions extends NhlClientOptions {
  /** Called for each minor field the API returned in an unexpected shape. Defaults to console.warn. */
  onWarning?: (warning: AdapterWarning) => void;
}

/** Orchestrates endpoints; validation lives in raw-types.ts, shape conversion in mappers.ts. */
export class NhlAdapter implements LeagueAdapter {
  readonly league = LEAGUE;

  private readonly client: NhlClient;
  private readonly onWarning: (warning: AdapterWarning) => void;

  constructor(options: NhlAdapterOptions = {}) {
    this.client = new NhlClient(options);
    this.onWarning = options.onWarning ?? ((w) => console.warn(`[nhl] ${w.message} (${w.url})`));
  }

  private async fetch<T extends z.ZodType>(
    path: string,
    schema: T,
    options: RequestOptions = {},
  ): Promise<z.output<T>> {
    const data = await this.client.get(path);
    const onWarning = options.onWarning ?? this.onWarning;
    return parseResponse(schema, data, `${this.client.baseUrl}${path}`, onWarning);
  }

  async getScores(date: string, options?: RequestOptions): Promise<Game[]> {
    const raw = await this.fetch(`/score/${date}`, RawScoreResponseSchema, options);
    return (raw.games ?? []).map(mapGame);
  }

  async getStandings(options?: RequestOptions): Promise<Standings> {
    const raw = await this.fetch("/standings/now", RawStandingsResponseSchema, options);
    return mapStandings(raw);
  }

  async getLeaders(query: LeaderQuery = {}, options?: RequestOptions): Promise<LeaderBoard[]> {
    const limit = query.limit ?? 10;
    const category = query.category;
    const isGoalie = category !== undefined && GOALIE_LEADER_CATEGORIES.includes(category);
    const categories = category ? [category] : SKATER_LEADER_CATEGORIES;
    const kind = isGoalie ? "goalie" : "skater";

    const raw = await this.fetch(
      `/${kind}-stats-leaders/current?categories=${categories.join(",")}&limit=${limit}`,
      RawLeadersResponseSchema,
      options,
    );
    return mapLeaders(raw, categories);
  }

  async getGameDetail(gameId: string, options?: RequestOptions): Promise<GameDetail> {
    const raw = await this.fetch(`/gamecenter/${gameId}/boxscore`, RawBoxscoreSchema, options);
    const game = mapGame(raw);
    return {
      game,
      goals: game.status === "scheduled" ? undefined : await this.getGoals(raw.id, raw.gameDate, options),
      boxscore: {
        home: mapBoxscoreSide(raw.playerByGameStats?.homeTeam),
        away: mapBoxscoreSide(raw.playerByGameStats?.awayTeam),
      },
    };
  }

  /**
   * The box score has no scoring summary, but the scores response for the game's date does.
   * Goals are an extra: if this call fails the game page still shows, without them.
   */
  private async getGoals(id: number, date: string | undefined, options?: RequestOptions): Promise<Goal[] | undefined> {
    if (!date) return undefined;
    try {
      const raw = await this.fetch(`/score/${date}`, RawScoreResponseSchema, options);
      return mapGoals(raw.games?.find((g) => g.id === id)?.goals);
    } catch {
      return undefined;
    }
  }
}
