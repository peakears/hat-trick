import { useCallback } from "react";
import { useSettings } from "../settings/settings-context";
import { playHaptic, type HapticKind } from "./haptics-native";

/**
 * A function that plays a light tap of the given kind, or does nothing while Settings › Haptic feedback is off.
 * Taps are kept to actions whose result is not felt otherwise (a pull to refresh let go, a swipe to another day),
 * never on every button, so they stay useful rather than annoying.
 */
export function useHaptic(): (kind: HapticKind) => void {
  const { settings } = useSettings();
  const enabled = settings.haptics;
  return useCallback(
    (kind: HapticKind) => {
      if (enabled) playHaptic(kind);
    },
    [enabled],
  );
}
