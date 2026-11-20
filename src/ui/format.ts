// Display formatting for the app. Pure functions over domain types (no React Native imports),
// so they are unit tested under Node.

import type { Game, GameStatus, StandingRow, Standings, Team } from "../domain";

/** A Date's local calendar date as YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Local hour at which the Scores tab's "Today" moves to the next date. Games often end after
 * midnight, so until then "Today" keeps showing last night's games.
 */
export const DAY_ROLLOVER_HOUR = 5;

/** The date the Scores tab calls "Today": the local date, except before DAY_ROLLOVER_HOUR. */
export function scoresToday(now: Date = new Date()): string {
  // Local-time constructor: a negative hour rolls back into the previous day, DST included.
  const shifted = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours() - DAY_ROLLOVER_HOUR,
    now.getMinutes(),
  );
  return localDate(shifted);
}

/** Shifts a YYYY-MM-DD date by whole days. Works in UTC, so DST changes cannot skip a day. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * A YYYY-MM-DD date as a local Date for a date picker. Noon, so a DST change can never move it
 * to another day.
 */
export function dateToPickerValue(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** The calendar date a date picker returned, as YYYY-MM-DD (the picker works in local time). */
export function pickerValueToDate(value: Date): string {
  return localDate(value);
}

/** "Today", "Yesterday", "Tomorrow", or a short date like "Fri, Nov 20". */
export function dateLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  if (date === addDays(today, 1)) return "Tomorrow";
  // Noon UTC on that date, formatted in UTC: the calendar date never shifts.
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** A time of day in the device's time zone and locale, e.g. "7:00 PM". */
export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** The short status shown next to a game: start time, live clock, or how it ended. */
export function gameStatusLabel(game: Game): string {
  switch (game.status) {
    case "scheduled":
      return timeLabel(game.startTime);
    case "live": {
      const clock = game.clock;
      if (!clock) return "Live";
      if (clock.intermission) {
        return clock.intermissionRemaining
          ? `${clock.label} INT ${clock.intermissionRemaining}`
          : `${clock.label} INT`;
      }
      return clock.timeRemaining ? `${clock.label} ${clock.timeRemaining}` : clock.label;
    }
    case "final":
      if (game.endedIn === "overtime") return "Final/OT";
      if (game.endedIn === "shootout") return "Final/SO";
      return "Final";
    case "postponed":
      return "Postponed";
  }
}

// Scores tab order: live games first, then upcoming, then finished; postponed last.
const STATUS_ORDER: Record<GameStatus, number> = { live: 0, scheduled: 1, final: 2, postponed: 3 };

/**
 * Games in Scores tab order: by status (STATUS_ORDER), then by start time, then by id so the
 * order never jumps between polls. Returns a new array.
 */
export function sortGamesForScores(games: readonly Game[]): Game[] {
  return [...games].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      Date.parse(a.startTime) - Date.parse(b.startTime) ||
      a.id.localeCompare(b.id),
  );
}

/** A season record: "W-L-OT" when the league has OT losses (hockey), otherwise "W-L". */
export function recordLabel(row: Pick<StandingRow, "wins" | "losses" | "otLosses">): string {
  return row.otLosses === undefined ? `${row.wins}-${row.losses}` : `${row.wins}-${row.losses}-${row.otLosses}`;
}

/**
 * A team's current season record from the standings, or undefined if the team is not in them.
 * Standings are "now", so for an older game this is today's record, not the record at the time.
 */
export function teamRecord(standings: Standings | undefined, team: Team): string | undefined {
  for (const group of standings?.groups ?? []) {
    const row = group.rows.find((r) => r.team.id === team.id);
    if (row) return recordLabel(row);
  }
  return undefined;
}

/** The winning side of a final game, or undefined (not final, or tied scores). */
export function winner(game: Game): "home" | "away" | undefined {
  const { home, away } = game;
  if (game.status !== "final" || home.score === null || away.score === null) return undefined;
  if (home.score === away.score) return undefined;
  return home.score > away.score ? "home" : "away";
}

/**
 * A leader or stat value: integers as-is, rates below 1 as ".925", other decimals with two places.
 * Strings (already formatted by the adapter, like "18:32") pass through.
 */
export function statValue(value: string | number | undefined): string {
  if (value === undefined) return "-";
  if (typeof value === "string") return value;
  if (Number.isInteger(value)) return String(value);
  if (Math.abs(value) < 1) return value.toFixed(3).replace(/^(-?)0\./, "$1.");
  return value.toFixed(2);
}
