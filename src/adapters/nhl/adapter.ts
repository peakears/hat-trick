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
import type {
  RawBoxscore,
  RawLeadersResponse,
  RawScoreResponse,
  RawStandingsResponse,
} from "./raw-types";

export type NhlAdapterOptions = NhlClientOptions;

/** Orchestrates endpoints; all shape conversion lives in mappers.ts. */
export class NhlAdapter implements LeagueAdapter {
  readonly league = LEAGUE;

  private readonly client: NhlClient;

  constructor(options: NhlAdapterOptions = {}) {
    this.client = new NhlClient(options);
  }

  async getScores(date: string): Promise<Game[]> {
    const raw = await this.client.get<RawScoreResponse>(`/score/${date}`);
    return (raw.games ?? []).map(mapGame);
  }

  async getStandings(): Promise<Standings> {
    const raw = await this.client.get<RawStandingsResponse>("/standings/now");
    return mapStandings(raw);
  }

  async getLeaders(query: LeaderQuery = {}): Promise<LeaderBoard[]> {
    const limit = query.limit ?? 10;
    const category = query.category;
    const isGoalie = category !== undefined && GOALIE_LEADER_CATEGORIES.includes(category);
    const categories = category ? [category] : SKATER_LEADER_CATEGORIES;
    const kind = isGoalie ? "goalie" : "skater";

    const raw = await this.client.get<RawLeadersResponse>(
      `/${kind}-stats-leaders/current?categories=${categories.join(",")}&limit=${limit}`,
    );
    return mapLeaders(raw, categories);
  }

  async getGameDetail(gameId: string): Promise<GameDetail> {
    const raw = await this.client.get<RawBoxscore>(`/gamecenter/${gameId}/boxscore`);
    return {
      game: mapGame(raw),
      boxscore: {
        home: mapBoxscoreSide(raw.playerByGameStats?.homeTeam),
        away: mapBoxscoreSide(raw.playerByGameStats?.awayTeam),
      },
    };
  }
}
