// Pure helpers for the Leaders tab (no React Native imports; tested in leaders.test.ts).

/** How many players each category asks the league for: the most "Show more" reveals. */
export const LEADERS_MAX = 20;

/** How many players a category shows before "Show more". */
export const LEADERS_SHOWN = 5;

/** The entries a category shows, and whether there are more behind "Show more". */
export function visibleLeaders<T>(entries: readonly T[], expanded: boolean): { shown: T[]; hasMore: boolean } {
  const all = entries.slice(0, LEADERS_MAX);
  const shown = expanded ? all : all.slice(0, LEADERS_SHOWN);
  return { shown, hasMore: all.length > LEADERS_SHOWN };
}

/** The key that remembers whether one category is expanded, separate for skaters and goalies. */
export function leaderSectionKey(kind: string, category: string): string {
  return `${kind}:${category}`;
}

/** The line under a spotlight player's name: "EDM · #97 · C", leaving out whatever is unknown. */
export function spotlightDetail(entry: {
  team: { abbrev: string };
  sweaterNumber?: number;
  player: { position?: string };
}): string {
  return [
    entry.team.abbrev,
    entry.sweaterNumber !== undefined ? `#${entry.sweaterNumber}` : undefined,
    entry.player.position,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A leader's value as shown: "64.0%" for a percent board, otherwise as `statValue` shows it. */
export function leaderValue(
  value: number,
  format: "percent" | undefined,
  statValue: (v: number) => string,
  decimals?: number,
): string {
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  if (decimals !== undefined) return value.toFixed(decimals);
  return statValue(value);
}

/**
 * Whether a board ranks the lowest value first (goals against average). The league sends each board best first, so
 * its order says which way it runs; no board needs naming.
 */
export function lowerIsBetter(entries: readonly { value: number }[]): boolean {
  return entries.length > 1 && entries[0].value < entries[entries.length - 1].value;
}

/**
 * How full a leader's bar is, 0-1, against the board's best: value / best, or best / value when lower is better.
 * A board of zeros is full for everyone.
 */
export function leaderBarShare(value: number, entries: readonly { value: number }[]): number {
  if (entries.length === 0) return 0;
  const best = entries[0].value;
  const share = lowerIsBetter(entries) ? (value > 0 ? best / value : 1) : best > 0 ? value / best : 1;
  return Math.max(0, Math.min(1, share));
}

/**
 * The line under a board's leader: "Leads by 5" (in the board's own format), "Tied for first" when the next has the
 * same value, or nothing for a board of one.
 */
export function leadLine(
  entries: readonly { value: number }[],
  format: "percent" | undefined,
  statValue: (v: number) => string,
  decimals?: number,
): string | undefined {
  if (entries.length < 2) return undefined;
  const gap = Math.abs(entries[0].value - entries[1].value);
  // Rounded as shown, so "Leads by 0.0" never appears for a gap the board does not show.
  const shown = leaderValue(gap, format, statValue, decimals);
  if (gap === 0 || Number(shown.replace("%", "")) === 0) return "Tied for first";
  return `Leads by ${shown}`;
}
