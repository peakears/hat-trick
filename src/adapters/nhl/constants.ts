import type { StatColumn } from "../../domain";

export const LEAGUE = "nhl" as const;
export const DEFAULT_BASE_URL = "https://api-web.nhle.com/v1";
export const DEFAULT_TIMEOUT_MS = 10_000;

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

export const SKATER_LEADER_CATEGORIES = ["goals", "assists", "points"];
export const GOALIE_LEADER_CATEGORIES = ["wins", "savePctg", "goalsAgainstAverage", "shutouts"];

export const LEADER_LABELS: Record<string, string> = {
  goals: "Goals",
  assists: "Assists",
  points: "Points",
  wins: "Wins",
  savePctg: "Save percentage",
  goalsAgainstAverage: "Goals against average",
  shutouts: "Shutouts",
};
