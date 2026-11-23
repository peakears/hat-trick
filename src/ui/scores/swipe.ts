// Turns a horizontal drag into "previous day" or "next day". Pure, so it is unit tested.

export const SWIPE = {
  /** Distance (px) a drag must travel to count as a swipe. */
  minDistance: 60,
  /** The drag must be this many times wider than tall, so scrolling the list never changes the day. */
  dominance: 2,
  /** How far a drag must go sideways before this takes it over from the list. */
  claimDistance: 15,
} as const;

/** True when a drag in progress is clearly sideways, so the swipe handler should take it over. */
export function isHorizontalDrag(dx: number, dy: number): boolean {
  return Math.abs(dx) > SWIPE.claimDistance && Math.abs(dx) > Math.abs(dy) * SWIPE.dominance;
}

/** Swipe left goes to the next day (+1), swipe right to the previous (-1), anything else 0. */
export function swipeDayStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE.minDistance || Math.abs(dx) < Math.abs(dy) * SWIPE.dominance) return 0;
  return dx < 0 ? 1 : -1;
}
