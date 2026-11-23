import type { Game } from "../../domain";
import { involvesFavorite } from "../team/favorites";
import { gameStatusLabel } from "../common/format";

/**
 * Puck drop reminders: which local notifications should exist, and how to get from what is
 * scheduled now to that plan. Pure (no React Native or notification-library imports), so it is
 * unit tested; `use-reminders.ts` does the actual scheduling.
 */

/** Prefix of every notification id this app schedules, so it never touches anyone else's. */
export const REMINDER_ID_PREFIX = "puckdrop:";

export interface Reminder {
  /** `puckdrop:<game id>`: one reminder per game, so a changed start time replaces the old one. */
  id: string;
  gameId: string;
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

export function reminderId(gameId: string): string {
  return `${REMINDER_ID_PREFIX}${gameId}`;
}

/**
 * The reminders to have scheduled: one for each upcoming game that involves a favourite team and
 * whose reminder time is still in the future, soonest first. Games that are live, final or
 * postponed get none.
 */
export function planReminders(
  games: readonly Game[],
  favorites: readonly string[],
  leadMinutes: number,
  now: number,
): Reminder[] {
  const byGame = new Map<string, Reminder>();
  for (const game of games) {
    if (game.status !== "scheduled" || !involvesFavorite(game, favorites)) continue;
    const start = Date.parse(game.startTime);
    if (Number.isNaN(start)) continue;
    const fireAt = start - leadMinutes * 60_000;
    if (fireAt <= now) continue;
    byGame.set(game.id, {
      id: reminderId(game.id),
      gameId: game.id,
      fireAt,
      title: `Puck drop in ${leadMinutes} minutes`,
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
