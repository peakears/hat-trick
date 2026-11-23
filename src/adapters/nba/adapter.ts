import type { z } from "zod";
import type {
  AdapterWarning,
  Game,
  LeaderBoard,
  LeaderQuery,
  LeagueAdapter,
  RequestOptions,
  Standings,
} from "../../domain";
import { NbaClient, type NbaClientOptions } from "./client";
import { DEFAULT_LEADER_LIMIT, LEADER_CATEGORIES, LEADERS_URL, LEAGUE, SITE_URL, STANDINGS_URL } from "./constants";
import { mapLeaderBoard, mapScoreboard, mapStandings } from "./mappers";
import { RawLeadersSchema, RawScoreboardSchema, RawStandingsSchema } from "./raw-types";
import { parseResponse } from "./validate";

export interface NbaAdapterOptions extends NbaClientOptions {
  /** Called for each minor field the API returned in an unexpected shape. Defaults to console.warn. */
  onWarning?: (warning: AdapterWarning) => void;
  /** Injectable clock for tests (the standings' updatedAt). */
  now?: () => Date;
}

/**
 * The NBA from ESPN's keyless site API. Scores, standings and leaders only: the optional features (game, team and
 * player pages, special events, spotlight) are left out until they are built, so the app hides what leads there.
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
}
