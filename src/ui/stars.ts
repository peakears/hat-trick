import type { GameStar } from "../domain";

/**
 * Text for the three stars card on the game page. Pure (no React Native imports), so it is unit tested.
 */

const TITLES = ["First star", "Second star", "Third star"];

/** "First star"; a rank past 3 (no league does this today) reads "Star 4". */
export function starTitle(rank: number): string {
  return TITLES[rank - 1] ?? `Star ${rank}`;
}

/** "LAK · #35 · G", leaving out whatever is unknown. */
export function starPlayerLine(star: GameStar): string {
  const { player, sweaterNumber } = star;
  return [player.teamId, sweaterNumber !== undefined ? `#${sweaterNumber}` : undefined, player.position]
    .filter(Boolean)
    .join(" · ");
}

/** "29 saves · 1.000 SV%", or "" when no stats are known. */
export function starStatLine(star: GameStar): string {
  return star.stats.map((s) => `${s.value} ${s.label}`).join(" · ");
}

/** What a screen reader says for one star: "First star, D. Kuemper, LAK, 29 saves, 1.000 SV%". */
export function starAccessibilityLabel(star: GameStar): string {
  return [starTitle(star.rank), star.player.name, star.player.teamId, ...star.stats.map((s) => `${s.value} ${s.label}`)]
    .filter(Boolean)
    .join(", ");
}

/** Up to two initials for a headshot that cannot be shown: "D. Kuemper" -> "DK". */
export function initials(name: string): string {
  const letters = name
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase());
  return letters.length > 2 ? letters[0]! + letters[letters.length - 1]! : letters.join("");
}
