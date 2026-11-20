// Domain model + adapter contract for the sports app.
// Nothing in here knows about any league's raw API shapes.

export type LeagueId = "nhl" | (string & {});

// ---------- Core entities ----------

export interface Team {
  id: string;
  league: LeagueId;
  name: string;
  abbrev: string;
  logoUrl?: string;
}

export interface Player {
  id: string;
  league: LeagueId;
  name: string;
  teamId?: string;
  position?: string;
  headshotUrl?: string;
}

// ---------- Games ----------

export type GameStatus = "scheduled" | "live" | "final" | "postponed";

export interface GameClock {
  period: number;
  label: string; // "2nd", "OT", "SO" - adapter formats it
  timeRemaining?: string; // period clock, "12:34"; undefined during an intermission
  intermission?: boolean; // true between periods; `period` is the one just finished
  intermissionRemaining?: string; // intermission countdown, "03:05"
}

/** How a final game was decided. */
export type GameEnding = "regulation" | "overtime" | "shootout";

export interface GameSide {
  team: Team;
  score: number | null; // null before puck drop
  shotsOnGoal?: number;
  /** Season record before the game, "13-7-1" (W-L-OT in hockey). Only sent for games that have not started. */
  record?: string;
}

/** Who a TV feed is for: everyone in a country, or only fans of the home or away team. */
export type BroadcastMarket = "national" | "home" | "away";

export interface Broadcast {
  network: string; // "SN", "TNT", "NESN" - as the league names it, trimmed
  country: string; // ISO 3166 alpha-2, "CA" or "US"
  market: BroadcastMarket;
}

/** Where a game is played. `city` is only known for some responses (the NHL box score has it, the scores list does not). */
export interface Venue {
  name: string; // arena, "TD Garden"
  city?: string; // "Boston"
}

export interface Game {
  id: string;
  league: LeagueId;
  startTime: string; // ISO 8601, UTC
  status: GameStatus;
  clock?: GameClock; // only while live
  endedIn?: GameEnding; // only when final
  home: GameSide;
  away: GameSide;
  /** TV listings in every country the league reports, in the league's order. Empty or absent when none are known. */
  broadcasts?: Broadcast[];
  venue?: Venue;
}

// ---------- Generic stat tables ----------
// Lets the UI render any sport's stats without knowing the columns.

export interface StatColumn {
  key: string;
  label: string; // "G", "A", "SOG"
  align?: "left" | "right";
}

export interface StatRow {
  player: Player;
  /** Keyed by StatColumn.key. A missing key means the stat is not available (show "-"), not zero. */
  values: Record<string, string | number>;
}

export interface StatTable {
  title: string; // "Forwards", "Defense", "Goalies"
  columns: StatColumn[];
  rows: StatRow[];
}

/** Strength of a goal. Even strength is the default and has no tag. */
export type GoalStrength = "even" | "powerPlay" | "shortHanded";

export interface Goal {
  /** Team that scored. */
  teamId: string;
  period: number;
  periodLabel: string; // "1st", "OT", "2OT", "SO" - adapter formats it
  time: string; // elapsed in the period, "15:46"
  scorer: Player;
  assists: Player[]; // empty for an unassisted goal
  strength: GoalStrength;
  emptyNet: boolean;
  penaltyShot: boolean;
  /** Score right after this goal. */
  homeScore?: number;
  awayScore?: number;
}

export interface GameDetail {
  game: Game;
  boxscore: { home: StatTable[]; away: StatTable[] };
  /** In the order scored. Absent when the league has no goal list for this game (yet); empty when no goals. */
  goals?: Goal[];
}

// ---------- Standings ----------

/** A team's results over some stretch of the season: all of it, home games, road games, the last 10. */
export interface RecordSplit {
  wins: number;
  losses: number;
  otLosses?: number; // hockey only
  goalsFor?: number;
  goalsAgainst?: number;
}

export interface StandingRow {
  team: Team;
  /** Position within the group the row sits in (the division for the NHL). */
  rank: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses?: number; // hockey only
  points?: number;
  streak?: string; // "W3"
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifferential?: number;
  last10?: RecordSplit;
  home?: RecordSplit;
  road?: RecordSplit;
  divisionName?: string;
}

export interface StandingsGroup {
  name: string; // "Atlantic", "Eastern Conference", or "League"
  rows: StandingRow[];
}

export interface Standings {
  league: LeagueId;
  groups: StandingsGroup[];
  updatedAt: string;
}

// ---------- Leaders ----------

export interface LeaderEntry {
  rank: number; // tied values share a rank: 1, 2, 2, 4
  player: Player;
  team: Team;
  value: number;
}

export interface LeaderBoard {
  category: string; // "goals", "assists", "points"
  label: string;
  entries: LeaderEntry[];
}

// ---------- Adapter contract ----------

export interface LeaderQuery {
  category?: string;
  limit?: number;
}

/** A minor problem in an API response that the adapter worked around (see the adapter's validation). */
export interface AdapterWarning {
  url: string;
  message: string; // savePctg: unexpected value ".905" (string), ignored
}

export interface RequestOptions {
  /** Receives warnings for this request only. Overrides the adapter's default handler. */
  onWarning?: (warning: AdapterWarning) => void;
}

export interface LeagueAdapter {
  readonly league: LeagueId;

  /** All games on a league calendar date, YYYY-MM-DD. */
  getScores(date: string, options?: RequestOptions): Promise<Game[]>;

  getStandings(options?: RequestOptions): Promise<Standings>;

  getLeaders(query?: LeaderQuery, options?: RequestOptions): Promise<LeaderBoard[]>;

  getGameDetail(gameId: string, options?: RequestOptions): Promise<GameDetail>;
}
