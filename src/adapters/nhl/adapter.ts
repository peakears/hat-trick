import type { z } from "zod";
import type {
  AdapterWarning,
  Game,
  GameDetail,
  GamePlays,
  GameStar,
  GameVideo,
  Penalty,
  Goal,
  LeaderBoard,
  LeaderQuery,
  SpecialEvents,
  SpotlightEntry,
  LeagueAdapter,
  PlayerDetail,
  RequestOptions,
  Standings,
  TeamDetail,
} from "../../domain";
import { NhlClient, type NhlClientOptions } from "./client";
import { GOALIE_LEADER_CATEGORIES, LEAGUE, SKATER_LEADER_CATEGORIES } from "./constants";
import {
  mapBoxscoreSide,
  mapClubStats,
  mapGame,
  mapGameVideos,
  mapGoals,
  mapLeaders,
  landingSpecialEvent,
  mapSpecialEvents,
  mapSpotlight,
  mapStandings,
  mapPlayerDetail,
  mapTeamSchedule,
  mapPenalties,
  mapPlayByPlay,
  mapThreeStars,
} from "./mappers";
import {
  type RawBoxscore,
  RawBoxscoreSchema,
  RawClubScheduleSchema,
  RawClubStatsSchema,
  RawLandingSchema,
  RawPlayByPlaySchema,
  RawLeadersResponseSchema,
  RawPlayerLandingSchema,
  RawScheduleSchema,
  RawSpotlightSchema,
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
  readonly name = "National Hockey League";
  readonly leaderGroups = [
    { id: "skaters", label: "Skaters" },
    { id: "goalies", label: "Goalies", categories: GOALIE_LEADER_CATEGORIES },
  ];

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

  async getSpecialEvents(date: string, options?: RequestOptions): Promise<SpecialEvents> {
    return mapSpecialEvents(await this.fetch(`/schedule/${date}`, RawScheduleSchema, options));
  }

  async getSpotlight(options?: RequestOptions): Promise<SpotlightEntry[]> {
    return mapSpotlight(await this.fetch("/player-spotlight", RawSpotlightSchema, options));
  }

  async getGameDetail(gameId: string, options?: RequestOptions): Promise<GameDetail> {
    const raw = await this.fetch(`/gamecenter/${gameId}/boxscore`, RawBoxscoreSchema, options);
    const game = mapGame(raw);
    const [fromScores, landing] = await Promise.all([
      game.status === "scheduled" ? undefined : this.getScoreExtras(raw.id, raw.gameDate, options),
      game.status === "final" ? this.getLanding(raw, options) : undefined,
    ]);
    return {
      // The box score has no special event; a final game's landing does (others get it from the week's schedule).
      game: { ...game, specialEvent: game.specialEvent ?? landing?.specialEvent },
      goals: fromScores?.goals,
      videos: fromScores?.videos,
      threeStars: landing?.threeStars,
      penalties: landing?.penalties,
      boxscore: {
        home: mapBoxscoreSide(raw.playerByGameStats?.homeTeam),
        away: mapBoxscoreSide(raw.playerByGameStats?.awayTeam),
      },
    };
  }

  /**
   * The box score has no scoring summary or videos, but the scores response for the game's date has both.
   * They are an extra: if this call fails the game page still shows, without them.
   */
  private async getScoreExtras(
    id: number,
    date: string | undefined,
    options?: RequestOptions,
  ): Promise<{ goals?: Goal[]; videos: GameVideo[] } | undefined> {
    if (!date) return undefined;
    try {
      const raw = await this.fetch(`/score/${date}`, RawScoreResponseSchema, options);
      const game = raw.games?.find((g) => g.id === id);
      return { goals: mapGoals(game?.goals), videos: mapGameVideos(game) };
    } catch (err) {
      this.extraFailed(`/score/${date}`, "goals and videos", err, options);
      return undefined;
    }
  }

  /**
   * The three stars and the penalties are only in the game's landing response (read after the game); it also names a
   * special event. Like the goals, they are an extra: if this call fails the game page shows without them.
   */
  private async getLanding(
    boxscore: RawBoxscore,
    options?: RequestOptions,
  ): Promise<{ threeStars?: GameStar[]; penalties?: Penalty[]; specialEvent?: string } | undefined> {
    try {
      const raw = await this.fetch(`/gamecenter/${boxscore.id}/landing`, RawLandingSchema, options);
      return {
        threeStars: mapThreeStars(raw, boxscore),
        penalties: mapPenalties(raw.summary?.penalties),
        specialEvent: landingSpecialEvent(raw),
      };
    } catch (err) {
      this.extraFailed(`/gamecenter/${boxscore.id}/landing`, "three stars, penalties and special event", err, options);
      return undefined;
    }
  }

  /** One request: the play-by-play has the game's state and score as well as its plays. */
  async getPlays(gameId: string, options?: RequestOptions): Promise<GamePlays> {
    const raw = await this.fetch(
      `/gamecenter/${encodeURIComponent(gameId)}/play-by-play`,
      RawPlayByPlaySchema,
      options,
    );
    return mapPlayByPlay(raw);
  }

  async getTeam(teamId: string, options?: RequestOptions): Promise<TeamDetail> {
    const team = encodeURIComponent(teamId);
    const [stats, schedule] = await Promise.all([
      this.fetch(`/club-stats/${team}/now`, RawClubStatsSchema, options),
      this.getTeamSchedule(team, teamId, options),
    ]);
    return { teamId, stats: mapClubStats(stats), ...schedule };
  }

  async getPlayer(playerId: string, options?: RequestOptions): Promise<PlayerDetail> {
    const raw = await this.fetch(`/player/${encodeURIComponent(playerId)}/landing`, RawPlayerLandingSchema, options);
    return mapPlayerDetail(raw);
  }

  /** Games are an extra on the team page: if this call fails the stats still show, without them. */
  private async getTeamSchedule(
    team: string,
    teamId: string,
    options?: RequestOptions,
  ): Promise<Pick<TeamDetail, "recent" | "upcoming" | "arena">> {
    try {
      return mapTeamSchedule(
        await this.fetch(`/club-schedule-season/${team}/now`, RawClubScheduleSchema, options),
        teamId,
      );
    } catch (err) {
      this.extraFailed(`/club-schedule-season/${team}/now`, "team games", err, options);
      return {};
    }
  }

  /** A best-effort extra failed: the screen shows without it, and the failure is passed on as a warning. */
  private extraFailed(path: string, what: string, err: unknown, options?: RequestOptions): void {
    const onWarning = options?.onWarning ?? this.onWarning;
    const reason = err instanceof Error ? err.message : String(err);
    onWarning({ url: `${this.client.baseUrl}${path}`, message: `${what} left out: ${reason}` });
  }
}
