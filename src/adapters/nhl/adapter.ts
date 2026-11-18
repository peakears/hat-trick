import type { z } from "zod";
import type {
  Game,
  GameDetail,
  LeaderBoard,
  LeaderQuery,
  LeagueAdapter,
  Standings,
} from "../../domain";
import { NhlClient, type NhlClientOptions } from "./client";
import { GOALIE_LEADER_CATEGORIES, LEAGUE, SKATER_LEADER_CATEGORIES } from "./constants";
import { mapBoxscoreSide, mapGame, mapLeaders, mapStandings } from "./mappers";
import {
  RawBoxscoreSchema,
  RawLeadersResponseSchema,
  RawScoreResponseSchema,
  RawStandingsResponseSchema,
} from "./raw-types";
import { parseResponse, type AdapterWarning } from "./validate";

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
    this.onWarning =
      options.onWarning ?? ((w) => console.warn(`[nhl] ${w.message} (${w.url})`));
  }

  private async fetch<T extends z.ZodType>(path: string, schema: T): Promise<z.output<T>> {
    const data = await this.client.get(path);
    return parseResponse(schema, data, `${this.client.baseUrl}${path}`, this.onWarning);
  }

  async getScores(date: string): Promise<Game[]> {
    const raw = await this.fetch(`/score/${date}`, RawScoreResponseSchema);
    return (raw.games ?? []).map(mapGame);
  }

  async getStandings(): Promise<Standings> {
    const raw = await this.fetch("/standings/now", RawStandingsResponseSchema);
    return mapStandings(raw);
  }

  async getLeaders(query: LeaderQuery = {}): Promise<LeaderBoard[]> {
    const limit = query.limit ?? 10;
    const category = query.category;
    const isGoalie = category !== undefined && GOALIE_LEADER_CATEGORIES.includes(category);
    const categories = category ? [category] : SKATER_LEADER_CATEGORIES;
    const kind = isGoalie ? "goalie" : "skater";

    const raw = await this.fetch(
      `/${kind}-stats-leaders/current?categories=${categories.join(",")}&limit=${limit}`,
      RawLeadersResponseSchema,
    );
    return mapLeaders(raw, categories);
  }

  async getGameDetail(gameId: string): Promise<GameDetail> {
    const raw = await this.fetch(`/gamecenter/${gameId}/boxscore`, RawBoxscoreSchema);
    return {
      game: mapGame(raw),
      boxscore: {
        home: mapBoxscoreSide(raw.playerByGameStats?.homeTeam),
        away: mapBoxscoreSide(raw.playerByGameStats?.awayTeam),
      },
    };
  }
}
