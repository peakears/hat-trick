import { useFonts } from "expo-font";
// One weight per import, so only these two files are bundled, not all eighteen.
import { BarlowSemiCondensed_600SemiBold } from "@expo-google-fonts/barlow-semi-condensed/600SemiBold";
import { BarlowSemiCondensed_700Bold } from "@expo-google-fonts/barlow-semi-condensed/700Bold";
import { FONT_FAMILIES } from "./fonts";

/**
 * Loads the bundled fonts (fonts.ts) from the app's own assets. The app does not wait for them: text draws in the
 * system font until they are ready, which is almost at once, and stays that way if loading fails.
 */
export function useAppFonts(): void {
  useFonts({
    [FONT_FAMILIES.scoreBold]: BarlowSemiCondensed_700Bold,
    [FONT_FAMILIES.scoreSemiBold]: BarlowSemiCondensed_600SemiBold,
  });
}
