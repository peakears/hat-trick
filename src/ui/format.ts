// Display formatting for the app. Pure functions over domain types (no React Native imports),
// so they are unit tested under Node.

import type { Game } from "../domain";

/** A Date's local calendar date as YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Shifts a YYYY-MM-DD date by whole days. Works in UTC, so DST changes cannot skip a day. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
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
