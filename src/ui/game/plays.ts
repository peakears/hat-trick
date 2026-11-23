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
