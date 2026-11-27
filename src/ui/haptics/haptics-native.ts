import { ImpactFeedbackStyle, impactAsync } from "expo-haptics";

/**
 * The only expo-haptics code. A short vibration (expo-haptics' "medium" impact: on Android 43 ms at a quarter of
 * full strength), rather than Android's own touch effects (performAndroidHapticsAsync), which are too faint to notice
 * on many phones and are off entirely when the phone's touch vibration is. The app's Haptic feedback switch is
 * checked before this is called; the phone's silent mode can still mute it. Never throws: a phone without a
 * vibrator, or Expo Go without the module, just feels nothing.
 */

/** What the tap is for: letting go of a pull to refresh, or a swipe that changed the day on Scores. */
export type HapticKind = "refresh" | "day";

export function playHaptic(_kind: HapticKind): void {
  try {
    impactAsync(ImpactFeedbackStyle.Medium).catch(() => {});
  } catch {
    // No native module (an old build or Expo Go): no tap.
  }
}
