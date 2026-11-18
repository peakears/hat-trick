// Raw response shapes for the unofficial NHL web API.
// Verified against live responses on 2026-11-17 (season 20262027): /score,
// /gamecenter/{id}/boxscore (live and final), /standings/now, and both
// stats-leaders endpoints. Fields marked optional were absent in at least one
// response or depend on game state. The API can still change without notice.

export interface Localized {
  default: string;
  fr?: string;
}

export interface RawTeam {
  id?: number;
  abbrev: string;
  name?: Localized; // /score only, e.g. "Bruins"
  commonName?: Localized; // boxscore only, e.g. "Bruins"
  placeName?: Localized; // boxscore only, e.g. "Boston"
  score?: number; // absent before the game starts
  sog?: number; // absent before the game starts
  record?: string; // scheduled games in /score only, "8-10-3"
  logo?: string; // light-background SVG
  darkLogo?: string; // boxscore only
}

export interface RawPeriodDescriptor {
  number: number;
  periodType: string; // "REG" | "OT" | "SO"
  maxRegulationPeriods?: number;
}

export interface RawClock {
  // During an intermission this counts down the intermission, not the period.
  timeRemaining?: string; // "03:05"
  secondsRemaining?: number;
  running?: boolean;
  inIntermission?: boolean;
}

export interface RawGame {
  id: number;
  season?: number; // 20262027
  gameType?: number; // 1 preseason, 2 regular season, 3 playoffs
  gameDate?: string; // league calendar date, YYYY-MM-DD
  startTimeUTC: string;
  venue?: Localized;
  // Seen: "FUT", "LIVE", "FINAL", "OFF". "PRE", "CRIT" and postponed values unverified.
  gameState: string;
  gameScheduleState?: string; // "OK"
  homeTeam: RawTeam;
  awayTeam: RawTeam;
  periodDescriptor?: RawPeriodDescriptor;
  clock?: RawClock;
  gameOutcome?: { lastPeriodType: string }; // final games only: "REG" | "OT" | "SO"
}

export interface RawScoreResponse {
  currentDate?: string;
  games?: RawGame[];
}

export interface RawStanding {
  seasonId?: number;
  date?: string;
  teamAbbrev: Localized;
  teamName: Localized; // "Edmonton Oilers"
  teamCommonName?: Localized; // "Oilers"
  teamLogo?: string;
  conferenceName?: string;
  conferenceAbbrev?: string;
  divisionName?: string;
  divisionAbbrev?: string;
  // Rank within each grouping, 1-based. The response is sorted by leagueSequence.
  leagueSequence?: number;
  conferenceSequence?: number;
  divisionSequence?: number;
  wildcardSequence?: number; // 0 for teams in a division top-3 spot
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses?: number;
  points?: number;
  pointPctg?: number;
  regulationWins?: number;
  goalFor?: number;
  goalAgainst?: number;
  goalDifferential?: number;
  streakCode?: string; // "W" | "L" | "OT"
  streakCount?: number;
  clinchIndicator?: string; // not present early in the season; unverified
}

export interface RawStandingsResponse {
  standingsDateTimeUtc?: string;
  wildCardIndicator?: boolean;
  standings?: RawStanding[];
}

export interface RawSkater {
  playerId: number;
  sweaterNumber?: number;
  name: Localized; // abbreviated, e.g. "J. Eichel"
  position?: string; // "C" | "L" | "R" | "D"
  goals?: number;
  assists?: number;
  points?: number;
  plusMinus?: number;
  pim?: number;
  hits?: number;
  sog?: number;
  blockedShots?: number;
  powerPlayGoals?: number;
  faceoffWinningPctg?: number; // not always present for defense
  shifts?: number;
  giveaways?: number;
  takeaways?: number;
  toi?: string; // "17:36"
}

export interface RawGoalie {
  playerId: number;
  sweaterNumber?: number;
  name: Localized;
  position?: string; // "G"
  starter?: boolean; // final games only
  shotsAgainst?: number;
  saves?: number;
  saveShotsAgainst?: string; // "23/25"
  goalsAgainst?: number;
  savePctg?: number; // absent for a goalie who did not play
  pim?: number;
  toi?: string; // "00:00" for a goalie who did not play
}

export interface RawSideStats {
  forwards?: RawSkater[];
  defense?: RawSkater[];
  goalies?: RawGoalie[];
}

export interface RawBoxscore extends RawGame {
  playerByGameStats?: { homeTeam?: RawSideStats; awayTeam?: RawSideStats };
}

export interface RawLeader {
  id: number;
  firstName: Localized;
  lastName: Localized;
  sweaterNumber?: number;
  headshot?: string;
  teamAbbrev: string;
  teamName?: Localized;
  teamLogo?: string;
  position?: string;
  value: number; // integer for counts, decimal for savePctg (0.939759) and GAA (1.4236)
}

// Keyed by category name, e.g. { goals: [...], assists: [...] }.
export type RawLeadersResponse = Record<string, RawLeader[]>;
