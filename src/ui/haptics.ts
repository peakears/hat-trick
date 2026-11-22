import { AndroidHaptics, ImpactFeedbackStyle, impactAsync, performAndroidHapticsAsync } from "expo-haptics";
import { Platform } from "react-native";

/**
 * The only expo-haptics code. On Android it uses the system's own haptic feedback, which follows the
 * phone's "Touch feedback" setting, so nothing is felt when the user turned it off. Never throws.
 */

/** A light tap when a pull to refresh is let go. */
export function refreshHaptic(): void {
  const done =
    Platform.OS === "android"
      ? performAndroidHapticsAsync(AndroidHaptics.Context_Click)
      : impactAsync(ImpactFeedbackStyle.Light);
  done.catch(() => {});
}
