// The Scores tab's week strip (pure): seven days with the chosen one in the middle, so a tap or a swipe always shows
// the days around it. Names are fixed English, not the phone's locale, like the rest of the app's text.
import { addDays } from "../common/format";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Days shown either side of the chosen one. */
const SIDE = 3;

export interface StripDay {
  date: string; // YYYY-MM-DD
  /** "TUE" */
  weekday: string;
  /** "24" */
  day: string;
  isToday: boolean;
  selected: boolean;
  /** "Tuesday 24 November, today" */
  spoken: string;
}

function parts(date: string): { weekday: string; day: number; month: string; year: number } {
  // Noon UTC on that date, read in UTC: the calendar date never shifts with the phone's time zone.
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: WEEKDAYS[d.getUTCDay()],
    day: d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
    year: d.getUTCFullYear(),
  };
}

/** "Tuesday 24 November", with the year when it is not the year of `today`. */
export function fullDateLabel(date: string, today: string): string {
  const p = parts(date);
  const sameYear = p.year === parts(today).year;
  return `${p.weekday} ${p.day} ${p.month}${sameYear ? "" : ` ${p.year}`}`;
}

/** The seven days around `date`, oldest first. */
export function weekStrip(date: string, today: string): StripDay[] {
  return Array.from({ length: SIDE * 2 + 1 }, (_, i) => {
    const d = addDays(date, i - SIDE);
    const p = parts(d);
    const isToday = d === today;
    return {
      date: d,
      weekday: p.weekday.slice(0, 3).toUpperCase(),
      day: String(p.day),
      isToday,
      selected: d === date,
      spoken: `${fullDateLabel(d, today)}${isToday ? ", today" : ""}`,
    };
  });
}
