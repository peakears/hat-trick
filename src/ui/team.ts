// Pure helpers for the team page (no React Native imports; tested in team.test.ts).
import type { RecordSplit, StandingRow, Standings } from "../domain";
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
  goals?: string; // "36 for, 19 against"
}

function splitLine(label: string, split: RecordSplit | undefined): SplitLine | undefined {
  if (!split) return undefined;
  const goals =
    split.goalsFor !== undefined && split.goalsAgainst !== undefined
      ? `${split.goalsFor} for, ${split.goalsAgainst} against`
      : undefined;
  return { label, record: recordLabel(split), goals };
}

/** Last 10, home and road, leaving out any the response did not have. */
export function splitLines(row: StandingRow): SplitLine[] {
  return [splitLine("Last 10", row.last10), splitLine("Home", row.home), splitLine("Road", row.road)].filter(
    (l): l is SplitLine => l !== undefined,
  );
}
