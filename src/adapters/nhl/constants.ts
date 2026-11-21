import type { StatColumn } from "../../domain";

export const LEAGUE = "nhl" as const;
export const DEFAULT_BASE_URL = "https://api-web.nhle.com/v1";
export const DEFAULT_TIMEOUT_MS = 10_000;
/** Playoff spots per conference after each division's top three. */
export const WILD_CARD_SPOTS = 2;

export const SKATER_COLUMNS: StatColumn[] = [
  { key: "goals", label: "G" },
  { key: "assists", label: "A" },
  { key: "points", label: "PTS" },
  { key: "plusMinus", label: "+/-" },
  { key: "sog", label: "SOG" },
  { key: "hits", label: "HIT" },
  { key: "pim", label: "PIM" },
  { key: "toi", label: "TOI" },
];

export const GOALIE_COLUMNS: StatColumn[] = [
  { key: "saves", label: "SV" },
  { key: "shotsAgainst", label: "SA" },
  { key: "goalsAgainst", label: "GA" },
  { key: "savePctg", label: "SV%" },
  { key: "toi", label: "TOI" },
];

// Season totals on the team page. Keys are the raw response fields, except `toi` (formatted from seconds).
export const SEASON_SKATER_COLUMNS: StatColumn[] = [
  { key: "gamesPlayed", label: "GP" },
  { key: "goals", label: "G" },
  { key: "assists", label: "A" },
  { key: "points", label: "PTS" },
  { key: "plusMinus", label: "+/-" },
  { key: "penaltyMinutes", label: "PIM" },
  { key: "powerPlayGoals", label: "PPG" },
  { key: "shots", label: "SOG" },
  { key: "shootingPctg", label: "S%" },
  { key: "toi", label: "TOI" }, // per game
];

export const SEASON_GOALIE_COLUMNS: StatColumn[] = [
  { key: "gamesPlayed", label: "GP" },
  { key: "gamesStarted", label: "GS" },
  { key: "wins", label: "W" },
  { key: "losses", label: "L" },
  { key: "overtimeLosses", label: "OTL" },
  { key: "goalsAgainstAverage", label: "GAA" },
  { key: "savePercentage", label: "SV%" },
  { key: "shotsAgainst", label: "SA" },
  { key: "shutouts", label: "SO" },
];

// Player page tables. Keys are the domain keys the mapper fills in.
export const PLAYER_GAME_SKATER_COLUMNS: StatColumn[] = [
  { key: "goals", label: "G" },
  { key: "assists", label: "A" },
  { key: "points", label: "PTS" },
  { key: "plusMinus", label: "+/-" },
  { key: "shots", label: "SOG" },
  { key: "pim", label: "PIM" },
  { key: "toi", label: "TOI" },
];

export const PLAYER_GAME_GOALIE_COLUMNS: StatColumn[] = [
  { key: "decision", label: "DEC" },
  { key: "shotsAgainst", label: "SA" },
  { key: "goalsAgainst", label: "GA" },
  { key: "savePctg", label: "SV%" },
  { key: "toi", label: "TOI" },
];

export const PLAYER_SEASON_SKATER_COLUMNS: StatColumn[] = [
  { key: "gamesPlayed", label: "GP" },
  { key: "goals", label: "G" },
  { key: "assists", label: "A" },
  { key: "points", label: "PTS" },
  { key: "plusMinus", label: "+/-" },
  { key: "pim", label: "PIM" },
];

export const PLAYER_SEASON_GOALIE_COLUMNS: StatColumn[] = [
  { key: "gamesPlayed", label: "GP" },
  { key: "wins", label: "W" },
  { key: "losses", label: "L" },
  { key: "otLosses", label: "OTL" },
  { key: "goalsAgainstAvg", label: "GAA" },
  { key: "savePctg", label: "SV%" },
  { key: "shutouts", label: "SO" },
];

/** How many recent and upcoming games the team page keeps. */
export const TEAM_GAMES_SHOWN = 5;

// In display order: points first, as the league and most apps list them.
export const SKATER_LEADER_CATEGORIES = ["points", "goals", "assists", "goalsPp", "faceoffLeaders", "penaltyMins"];
export const GOALIE_LEADER_CATEGORIES = ["wins", "savePctg", "goalsAgainstAverage", "shutouts"];

/** Categories whose value is a 0-1 fraction (0.640 for 64.0% of faceoffs won). */
export const PERCENT_LEADER_CATEGORIES = ["faceoffLeaders"];

export const LEADER_LABELS: Record<string, string> = {
  goals: "Goals",
  assists: "Assists",
  points: "Points",
  goalsPp: "Power-play goals",
  faceoffLeaders: "Faceoff %",
  penaltyMins: "Penalty minutes",
  wins: "Wins",
  savePctg: "Save percentage",
  goalsAgainstAverage: "Goals against average",
  shutouts: "Shutouts",
};
