import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  impactAsync,
  performAndroidHapticsAsync,
  selectionAsync,
} from "expo-haptics";
import { Platform } from "react-native";

/**
 * The only expo-haptics code. On Android it plays the system's own haptic effects, which follow the phone's
 * "Touch feedback" setting, so nothing is felt when that is off (the app's Haptic feedback switch is checked
 * before this is called). Never throws: a phone without a vibrator, or Expo Go without the module, just feels nothing.
 */

/** What the tap is for: letting go of a pull to refresh, or a swipe that changed the day on Scores. */
export type HapticKind = "refresh" | "day";

export function playHaptic(kind: HapticKind): void {
  try {
    const done =
      Platform.OS === "android"
        ? performAndroidHapticsAsync(kind === "day" ? AndroidHaptics.Clock_Tick : AndroidHaptics.Context_Click)
        : kind === "day"
          ? selectionAsync()
          : impactAsync(ImpactFeedbackStyle.Light);
    done.catch(() => {});
  } catch {
    // No native module (an old build or Expo Go): no tap.
  }
}
