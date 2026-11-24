// Pure helpers for the game page's points by period, team stats and attendance.
import type { Game, TeamStatLine } from "../../domain";

/**
 * How much of a team stat's bar is the away team's, 0-1. Even when both are 0. Undefined when the line has no
 * numbers to compare.
 */
export function awayShare(line: TeamStatLine): number | undefined {
  const { awayValue: a, homeValue: h } = line;
  if (a === undefined || h === undefined || a < 0 || h < 0) return undefined;
  return a + h === 0 ? 0.5 : a / (a + h);
}

/** "Field goal %: Nuggets 53%, Bulls 52%". */
export function teamStatSpoken(line: TeamStatLine, game: Game): string {
  return `${line.label}: ${game.away.team.name} ${line.away}, ${game.home.team.name} ${line.home}`;
}

/** "19,360": thousands separated by commas (not toLocaleString, whose output depends on the phone). */
export function attendanceLabel(attendance: number): string {
  return String(Math.round(attendance)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "Q1: Nuggets 33, Bulls 31", for a screen reader reading the period table one period at a time. */
export function periodSpoken(label: string, away: number, home: number, game: Game): string {
  return `${label}: ${game.away.team.name} ${away}, ${game.home.team.name} ${home}`;
}
