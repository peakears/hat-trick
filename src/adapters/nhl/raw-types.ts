// Raw response shapes for the unofficial NHL web API.
// Keep everything defensive: fields can be renamed or dropped without notice.

export interface Localized {
  default: string;
}

export interface RawTeam {
  id?: number;
  abbrev: string;
  name?: Localized;
  commonName?: Localized;
  placeName?: Localized;
  score?: number;
  sog?: number;
  logo?: string;
}

export interface RawGame {
  id: number;
  startTimeUTC: string;
  gameState: string;
  homeTeam: RawTeam;
  awayTeam: RawTeam;
  periodDescriptor?: { number: number; periodType: string };
  clock?: { timeRemaining?: string; inIntermission?: boolean };
}

export interface RawScoreResponse {
  games?: RawGame[];
}

export interface RawStanding {
  teamAbbrev: Localized;
  teamName: Localized;
  teamLogo?: string;
  divisionName?: string;
  divisionAbbrev?: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses?: number;
  points?: number;
  streakCode?: string;
  streakCount?: number;
}

export interface RawStandingsResponse {
  standings?: RawStanding[];
}

export interface RawSkater {
  playerId: number;
  name: Localized;
  position?: string;
  goals?: number;
  assists?: number;
  points?: number;
  plusMinus?: number;
  pim?: number;
  hits?: number;
  sog?: number;
  toi?: string;
}

export interface RawGoalie {
  playerId: number;
  name: Localized;
  position?: string;
  shotsAgainst?: number;
  saves?: number;
  goalsAgainst?: number;
  savePctg?: number;
  toi?: string;
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
  headshot?: string;
  teamAbbrev: string;
  teamName?: Localized;
  teamLogo?: string;
  position?: string;
  value: number;
}

export type RawLeadersResponse = Record<string, RawLeader[]>;
