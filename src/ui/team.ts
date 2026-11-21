// Pure helpers for the team page (no React Native imports; tested in team.test.ts).
import type { Game, RecordSplit, StandingRow, Standings, Team } from "../domain";
import { recordLabel } from "./format";

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd". */
export function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** The team's row in the standings, or undefined if it is not in them. */
export function findStandingRow(standings: Standings | undefined, teamId: string): StandingRow | undefined {
  for (const group of standings?.groups ?? []) {
    const row = group.rows.find((r) => r.team.id === teamId);
    if (row) return row;
  }
  return undefined;
}

/** "+30", "-5" or "0". */
export function goalDifferentialLabel(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** Where the team stands in its division: "1st in Pacific" ("4th" when the league names no division). */
export function rankLine(row: StandingRow): string {
  return `${ordinal(row.rank)}${row.divisionName ? ` in ${row.divisionName}` : ""}`;
}

export interface SplitLine {
  label: string;
  record: string; // "8-1-1"
  goals?: string; // "Scored 36 · Allowed 19"
}

function splitLine(label: string, split: RecordSplit | undefined): SplitLine | undefined {
  if (!split) return undefined;
  const goals =
    split.goalsFor !== undefined && split.goalsAgainst !== undefined
      ? `Scored ${split.goalsFor} · Allowed ${split.goalsAgainst}`
      : undefined;
  return { label, record: recordLabel(split), goals };
}

/** Last 10, home and road, leaving out any the response did not have. */
export function splitLines(row: StandingRow): SplitLine[] {
  return [splitLine("Last 10", row.last10), splitLine("Home", row.home), splitLine("Road", row.road)].filter(
    (l): l is SplitLine => l !== undefined,
  );
}

// ---------- Compact game lines ----------

/** How many recent or upcoming games show before "Show more". */
export const TEAM_GAMES_COLLAPSED = 3;

/** The games to show in a team page section, and how many more are behind "Show more". */
export function visibleGames<T>(games: readonly T[], expanded: boolean): { shown: T[]; more: number } {
  const shown = expanded ? [...games] : games.slice(0, TEAM_GAMES_COLLAPSED);
  return { shown, more: games.length - shown.length };
}

/** One game from one team's side, for the compact list on its team page. */
export interface TeamGameLine {
  opponent: Team;
  /** True when the team is at home ("vs"), false on the road ("@"). */
  home: boolean;
  /** Final games only, and only when the spoiler shield is not hiding them. */
  result?: { won: boolean; score: string; endedIn?: "OT" | "SO" };
  /** Live games, when not hidden: the score with the team's goals first, "2-1". */
  liveScore?: string;
}

/** The game as `teamId` sees it: opponent, home or road, and (unless `hidden`) the result. */
export function teamGameLine(game: Game, teamId: string, hidden: boolean): TeamGameLine {
  const home = game.home.team.id === teamId;
  const us = home ? game.home : game.away;
  const them = home ? game.away : game.home;
  const line: TeamGameLine = { opponent: them.team, home };
  if (hidden || us.score === null || them.score === null) return line;
  const score = `${us.score}-${them.score}`;
  if (game.status === "live") return { ...line, liveScore: score };
  if (game.status === "final" && us.score !== them.score) {
    const endedIn = game.endedIn === "overtime" ? "OT" : game.endedIn === "shootout" ? "SO" : undefined;
    return { ...line, result: { won: us.score > them.score, score, endedIn } };
  }
  return line;
}

/** What a screen reader says for a compact game line, after the date: "at TOR, won 4-3 in overtime". */
export function teamGameSpoken(line: TeamGameLine): string {
  const where = `${line.home ? "vs" : "at"} ${line.opponent.name}`;
  if (line.result) {
    const how = line.result.endedIn === "OT" ? " in overtime" : line.result.endedIn === "SO" ? " in a shootout" : "";
    return `${where}, ${line.result.won ? "won" : "lost"} ${line.result.score}${how}`;
  }
  if (line.liveScore) return `${where}, live, ${line.liveScore}`;
  return where;
}
