import { useRouter } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { liveTrackingAvailable, onLiveNotificationTap } from "./live-tracker-native";
import { startLiveTracking, stopLiveTracking } from "./live-tracker-run";
import { useSettings } from "./settings-context";

/**
 * Starts the live score service when the app opens or comes back (including from a puck drop reminder), if a
 * favourite's game is live or about to start and the setting is on; stops it when the setting is turned off.
 * Also opens the game when a live score, goal or final notification is tapped. Mounted once, in the root layout.
 */
export function useLiveTracking(): void {
  const router = useRouter();
  const { settings, loaded } = useSettings();
  const { liveScores, favoriteTeams } = settings;

  useEffect(() => {
    if (!loaded || !liveTrackingAvailable()) return;
    if (!liveScores) {
      stopLiveTracking();
      return;
    }
    startLiveTracking().catch(() => {});
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") startLiveTracking().catch(() => {});
    });
    return () => subscription.remove();
  }, [loaded, liveScores, favoriteTeams]);

  useEffect(() => onLiveNotificationTap((id) => router.push({ pathname: "/game/[id]", params: { id } })), [router]);
}
