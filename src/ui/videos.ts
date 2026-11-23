/** Game and goal videos: what each row says and which links may be opened. Pure, tested in videos.test.ts. */

import type { Goal, GameVideo } from "../domain";

/** Row labels, recap first. */
export const VIDEO_LABELS: Record<GameVideo["kind"], { title: string; detail: string }> = {
  recap: { title: "Recap", detail: "Highlights in about 3 minutes" },
  condensed: { title: "Condensed game", detail: "The whole game, stoppages cut" },
};

/**
 * Only plain https web pages are opened. The adapter already accepts only the league's own video pages; this is the
 * league-agnostic check on top, so a cached or future link can never open another kind of URL.
 */
export function isOpenableVideoUrl(url: string | undefined): url is string {
  return url !== undefined && /^https:\/\/[a-z0-9.-]+\/[^\s]*$/i.test(url);
}

/** A game's videos that can be opened, recap first. */
export function playableVideos(videos: GameVideo[] | undefined): GameVideo[] {
  const order: GameVideo["kind"][] = ["recap", "condensed"];
  return (videos ?? [])
    .filter((v) => isOpenableVideoUrl(v.url))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

/** What a screen reader says for a goal's video button: "Watch M. Zuccarello's goal at 15:46 of the 1st". */
export function goalVideoLabel(goal: Goal): string {
  return `Watch ${goal.scorer.name}'s goal at ${goal.time} of the ${goal.periodLabel}`;
}
