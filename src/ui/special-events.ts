// Pure helpers for special event tags ("Winter Classic", "Original 6 Series"); tested in special-events.test.ts.
import type { Game, SpecialEvents } from "../domain";

/**
 * The Monday of the week holding `date` (YYYY-MM-DD). Special events are looked up a week at a time from this day,
 * so every day of a week shares one request and one cache entry.
 */
export function eventWeekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const sinceMonday = (day.getUTCDay() + 6) % 7; // getUTCDay: 0 is Sunday
  day.setUTCDate(day.getUTCDate() - sinceMonday);
  return day.toISOString().slice(0, 10);
}

/** The games with their special event filled in from `events` where the game itself does not name one. */
export function withSpecialEvents(games: Game[], events: SpecialEvents | undefined): Game[] {
  if (!events || Object.keys(events).length === 0) return games;
  return games.map((g) => (g.specialEvent || !events[g.id] ? g : { ...g, specialEvent: events[g.id] }));
}
