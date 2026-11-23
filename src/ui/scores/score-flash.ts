/**
 * When a score should flash: it went up while the game is live and on screen (not hidden by the
 * spoiler shield). Pure (no React Native imports), so it is unit tested.
 *
 * A score going down (a goal taken back after review) does not flash, and neither does the first
 * value a card sees, so opening a screen or switching day never sets every score flashing.
 */
export function shouldFlash(previous: number | null | undefined, next: number | null, enabled: boolean): boolean {
  return enabled && typeof previous === "number" && typeof next === "number" && next > previous;
}

/** How long the pop and glow take, in milliseconds. */
export const FLASH_MS = { grow: 160, settle: 260, glowHold: 900, glowFade: 700 } as const;
