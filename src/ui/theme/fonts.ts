// The app's fonts (pure). Text uses the system font; scores and other big numbers use Barlow Semi Condensed (SIL Open
// Font License), which is narrow, so a three-digit basketball score fits where a hockey score does. The font files
// are bundled with the app and loaded on start (use-app-fonts.ts): nothing is fetched. Until they load, or if loading
// fails, numbers fall back to the system font.

/** Family names, as registered by useAppFonts. */
export const FONT_FAMILIES = {
  scoreBold: "BarlowSemiCondensed_700Bold",
  scoreSemiBold: "BarlowSemiCondensed_600SemiBold",
} as const;

/**
 * Style for a score or another big number. No `fontWeight`: the family is the weight, and on Android a weight on a
 * custom family can pick a synthetic bold. Numbers stay tabular, so columns line up as they change.
 */
export const scoreFont = {
  fontFamily: FONT_FAMILIES.scoreBold,
  fontVariant: ["tabular-nums" as const],
};

/** The same at semibold, for smaller numbers (points by period, stat tiles). */
export const scoreFontSemiBold = {
  fontFamily: FONT_FAMILIES.scoreSemiBold,
  fontVariant: ["tabular-nums" as const],
};
