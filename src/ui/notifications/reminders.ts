import type { Game, LeagueId } from "../../domain";
import { favoritesFor, involvesFavorite } from "../team/favorites";
import { gameStatusLabel } from "../common/format";

/**
 * Game start reminders: which local notifications should exist, and how to get from what is
 * scheduled now to that plan. Pure (no React Native or notification-library imports), so it is
 * unit tested; `use-reminders.ts` does the actual scheduling.
 */

/** Prefix of every notification id this app schedules, so it never touches anyone else's. */
export const REMINDER_ID_PREFIX = "puckdrop:";

export interface Reminder {
  /** One reminder per game (reminderId), so a changed start time replaces the old one. */
  id: string;
  gameId: string;
  league: LeagueId;
  /** When the notification fires, epoch milliseconds. */
  fireAt: number;
  title: string;
  body: string;
}

/** A reminder already scheduled with the system. */
export interface ScheduledReminder {
  id: string;
  fireAt: number;
}

/**
 * `puckdrop:<game id>` for the NHL (the ids reminders had before there was another league, so reminders already
 * scheduled on phones are still recognised), `puckdrop:<league>:<game id>` for every other league. The prefix keeps
 * its old name for the same reason.
 */
export function reminderId(league: LeagueId, gameId: string): string {
  return league === "nhl" ? `${REMINDER_ID_PREFIX}${gameId}` : `${REMINDER_ID_PREFIX}${league}:${gameId}`;
}

/**
 * The reminders to have scheduled: one for each upcoming game that involves a favourite team and
 * whose reminder time is still in the future, soonest first. Games that are live, final or
 * postponed get none. `favorites` are `league:team` keys, matched in each game's own league; `startTerm` is the
 * league's word for the start ("Puck drop", "Tip-off").
 */
export function planReminders(
  games: readonly Game[],
  favorites: readonly string[],
  leadMinutes: number,
  now: number,
  startTerm: (league: LeagueId) => string,
): Reminder[] {
  const byGame = new Map<string, Reminder>();
  for (const game of games) {
    if (game.status !== "scheduled" || !involvesFavorite(game, favoritesFor(game.league, favorites))) continue;
    const start = Date.parse(game.startTime);
    if (Number.isNaN(start)) continue;
    const fireAt = start - leadMinutes * 60_000;
    if (fireAt <= now) continue;
    const id = reminderId(game.league, game.id);
    byGame.set(id, {
      id,
      gameId: game.id,
      league: game.league,
      fireAt,
      title: `${startTerm(game.league)} in ${leadMinutes} minutes`,
      body: `${game.away.team.name} at ${game.home.team.name}, ${gameStatusLabel(game)}`,
    });
  }
  return [...byGame.values()].sort((a, b) => a.fireAt - b.fireAt || a.id.localeCompare(b.id));
}

export interface ReminderChanges {
  /** Scheduled ids to cancel: no longer wanted, or about to be rescheduled at a new time. */
  cancel: string[];
  /** Reminders to schedule: new ones, and ones whose time changed. */
  schedule: Reminder[];
}

/**
 * What to cancel and schedule to turn `scheduled` into `planned`. A reminder that is already
 * scheduled at the right time is left alone, so syncing on every app start does not churn.
 */
export function diffReminders(scheduled: readonly ScheduledReminder[], planned: readonly Reminder[]): ReminderChanges {
  const wanted = new Map(planned.map((r) => [r.id, r]));
  const existing = new Map(scheduled.map((s) => [s.id, s]));
  const cancel = scheduled.filter((s) => wanted.get(s.id)?.fireAt !== s.fireAt).map((s) => s.id);
  const schedule = planned.filter((r) => existing.get(r.id)?.fireAt !== r.fireAt);
  return { cancel, schedule };
}

/** Where the app remembers what it scheduled (outside `cache:`, so pruning never drops it). */
export const SCHEDULED_KEY = "reminders:scheduled:v1";

export function serializeScheduled(reminders: readonly ScheduledReminder[]): string {
  return JSON.stringify(reminders.map(({ id, fireAt }) => ({ id, fireAt })));
}

/** Reads the stored list back; anything corrupt or malformed is dropped rather than trusted. */
export function parseScheduled(raw: string | null): ScheduledReminder[] {
  if (raw == null) return [];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(json)) return [];
  return json.flatMap((item): ScheduledReminder[] => {
    if (typeof item !== "object" || item === null) return [];
    const { id, fireAt } = item as Record<string, unknown>;
    return typeof id === "string" && id.startsWith(REMINDER_ID_PREFIX) && typeof fireAt === "number"
      ? [{ id, fireAt }]
      : [];
  });
}
