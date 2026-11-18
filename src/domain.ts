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

export interface GameDetail {
  game: Game;
  boxscore: { home: StatTable[]; away: StatTable[] };
}

// ---------- Standings ----------

export interface StandingRow {
  team: Team;
  rank: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses?: number; // hockey only
  points?: number;
  streak?: string; // "W3"
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

export interface LeagueAdapter {
  readonly league: LeagueId;

  /** All games on a calendar date, YYYY-MM-DD. */
  getScores(date: string): Promise<Game[]>;

  getStandings(): Promise<Standings>;

  getLeaders(query?: LeaderQuery): Promise<LeaderBoard[]>;

  getGameDetail(gameId: string): Promise<GameDetail>;
}
