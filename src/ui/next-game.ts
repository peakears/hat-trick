import type { Game, TeamDetail } from "../domain";
import { dateLabel, localDate, scoresToday } from "./format";

// Pure helpers for the team page's next game card.

/** The game the card shows: one being played now, else the next one still to play. */
export interface NextGame {
  game: Game;
  /** Which list it came from, so that list can leave it out instead of showing it twice. */
  from: "recent" | "upcoming";
}

/** A live game (it is in `recent`, which holds started games), else the first upcoming game that is not postponed. */
export function pickNextGame(detail: Pick<TeamDetail, "recent" | "upcoming"> | undefined): NextGame | undefined {
  const live = detail?.recent?.find((g) => g.status === "live");
  if (live) return { game: live, from: "recent" };
  const next = detail?.upcoming?.find((g) => g.status === "scheduled" || g.status === "live");
  return next ? { game: next, from: "upcoming" } : undefined;
}

/** `games` without the card's game, when the card took it from this list. */
export function withoutNextGame(
  games: Game[] | undefined,
  next: NextGame | undefined,
  list: NextGame["from"],
): Game[] | undefined {
  if (!games || !next || next.from !== list) return games;
  return games.filter((g) => g.id !== next.game.id);
}

/**
 * - later: before the day of the game ("Tue, Nov 24", "in 2 days")
 * - gameDay: on the day, before puck drop (a countdown)
 * - starting: the start time has passed but the league has not marked it live yet
 * - live: being played
 * - final: just ended, until the team's schedule moves on to the next game
 */
export type NextGamePhase = "later" | "gameDay" | "starting" | "live" | "final";

/** `today` is the Scores tab's today (it rolls over at 5am), so a late game counts as the same day. */
export function nextGamePhase(game: Game, now: number, today: string): NextGamePhase {
  if (game.status === "live" || game.status === "final") return game.status;
  const start = Date.parse(game.startTime);
  if (start <= now) return "starting";
  // The same 5am rollover on the game's side: a 12:30am puck drop belongs to the evening before.
  return scoresToday(new Date(start)) === today ? "gameDay" : "later";
}

const MINUTE = 60_000;

/** Time until puck drop: "3h 42m", "42 min", "Under 1 min". */
export function countdownLabel(startTime: string, now: number): string {
  const minutes = Math.floor((Date.parse(startTime) - now) / MINUTE);
  if (minutes < 1) return "Under 1 min";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Whole calendar days between two YYYY-MM-DD dates (noon UTC, so daylight saving cannot shift it). */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / (24 * 60 * MINUTE));
}

/** The card's header line: "Next game" and the date, "Tonight", "Today", or "Live now". */
export function nextGameHeading(game: Game, phase: NextGamePhase, today: string): { title: string; date?: string } {
  if (phase === "live") return { title: "Live now" };
  if (phase === "final") return { title: "Final" };
  if (phase === "starting") return { title: "Starting soon" };
  if (phase === "gameDay") return { title: new Date(game.startTime).getHours() >= 17 ? "Tonight" : "Today" };
  return { title: "Next game", date: dateLabel(localDate(new Date(game.startTime)), today) };
}

/** Under the start time before game day: "in 2 days". Undefined for tomorrow, which the heading already says. */
export function daysAwayLabel(game: Game, today: string): string | undefined {
  const days = daysBetween(today, localDate(new Date(game.startTime)));
  return days <= 1 ? undefined : `in ${days} days`;
}
