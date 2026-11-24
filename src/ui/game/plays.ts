// The play-by-play screen's lists (pure; tested in plays.test.ts).
import type { Play } from "../../domain";

/** Every play, or only the key ones: scores and penalties. */
export type PlayFilter = "key" | "all";

export interface PlayPeriod {
  /** "1st", "OT", "SO", as the adapter labels the period. */
  label: string;
  plays: Play[];
}

/** Whether a play stays in the list for `filter`. */
export function isKeyPlay(play: Play): boolean {
  return play.kind === "score" || play.kind === "penalty";
}

/**
 * The plays grouped by period. A live game reads newest first (the latest period on top, its latest play first),
 * so what just happened is at the top; a finished one reads in order, like a game sheet.
 */
export function playPeriods(
  plays: readonly Play[],
  options: { filter: PlayFilter; newestFirst: boolean },
): PlayPeriod[] {
  const out: PlayPeriod[] = [];
  for (const play of plays) {
    if (options.filter === "key" && !isKeyPlay(play)) continue;
    const last = out[out.length - 1];
    if (last && last.label === play.periodLabel) last.plays.push(play);
    else out.push({ label: play.periodLabel, plays: [play] });
  }
  if (!options.newestFirst) return out;
  return out.reverse().map((p) => ({ ...p, plays: [...p.plays].reverse() }));
}

/** The score after a scoring play, away team first like the game's score card: "2–1". */
export function playScoreLabel(play: Play): string | undefined {
  if (play.awayScore === undefined || play.homeScore === undefined) return undefined;
  return `${play.awayScore}–${play.homeScore}`;
}

/** What a screen reader says for a play: "1st, 03:22, TOR. Goal: ..., power play, 1–0". */
export function playSpoken(play: Play): string {
  const score = playScoreLabel(play);
  return [
    `${play.periodLabel}, ${play.time}${play.teamId ? `, ${play.teamId}` : ""}. ${play.text}`,
    play.tag?.toLowerCase(),
    score,
  ]
    .filter(Boolean)
    .join(", ");
}

// ---------- The game page's play-by-play card ----------

/** How many of a period's plays the card shows; "See all plays" opens the rest. */
export const CARD_PLAYS = 5;

/** The periods played so far, in order: the card's and the full page's tabs. */
export function playPeriodLabels(plays: readonly Play[]): string[] {
  const labels: string[] = [];
  for (const p of plays) if (!labels.includes(p.periodLabel)) labels.push(p.periodLabel);
  return labels;
}

/**
 * The period a tab bar shows: the one picked, while it is still there; otherwise the current one while the game is
 * live (so the card follows the game into the next period), or the first once it is over.
 */
export function shownPeriod(labels: readonly string[], picked: string | undefined, live: boolean): string | undefined {
  if (picked !== undefined && labels.includes(picked)) return picked;
  return live ? labels[labels.length - 1] : labels[0];
}

/**
 * The card's plays for one period: the latest few, newest first, while the game is live; the first few, in order,
 * once it is over (a finished period reads like a story). `more` is how many the full page has besides.
 */
export function cardPlays(
  plays: readonly Play[],
  period: string | undefined,
  live: boolean,
  limit = CARD_PLAYS,
): { shown: Play[]; more: number } {
  const inPeriod = plays.filter((p) => p.periodLabel === period);
  const ordered = live ? [...inPeriod].reverse() : inPeriod;
  const shown = ordered.slice(0, limit);
  return { shown, more: inPeriod.length - shown.length };
}
