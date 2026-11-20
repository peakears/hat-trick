import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { addDays, scoresToday } from "./format";
import { planReminders } from "./reminders";
import { applyReminders, cancelAllReminders, hasReminderPermission } from "./reminders-native";
import { useSettings } from "./settings-context";
import { LEAGUE, useSportsData } from "./sports-data-context";

/** How many days ahead to look for favourite teams' games (today plus the next six). */
const LOOKAHEAD_DAYS = 7;

/**
 * Keeps the scheduled puck drop reminders in step with the settings and the schedule. Re-checks
 * when a setting changes and each time the app comes to the foreground, which also picks up
 * postponed or rescheduled games. Mount once, inside the settings and sports data providers.
 */
export function useReminderSync(): void {
  const sports = useSportsData();
  const { settings } = useSettings();
  const { remindersEnabled, favoriteTeams, reminderLeadMinutes } = settings;
  const [foregrounded, setForegrounded] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setForegrounded((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      if (!remindersEnabled || favoriteTeams.length === 0) {
        await cancelAllReminders();
        return;
      }
      // Without the permission, scheduling would silently do nothing.
      if (!(await hasReminderPermission())) return;

      const first = scoresToday();
      const dates = Array.from({ length: LOOKAHEAD_DAYS }, (_, i) => addDays(first, i));
      const results = await Promise.allSettled(dates.map((d) => sports.getScores(LEAGUE, d)));
      // If any day failed to load, keep what is scheduled rather than cancel reminders for games we could not see.
      if (cancelled || results.some((r) => r.status === "rejected")) return;

      const games = results.flatMap((r) => (r.status === "fulfilled" ? r.value.data : []));
      await applyReminders(planReminders(games, favoriteTeams, reminderLeadMinutes, Date.now()));
    }
    sync().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sports, remindersEnabled, favoriteTeams, reminderLeadMinutes, foregrounded]);
}

/** Opens the game when a reminder notification is tapped (including when it launched the app). */
export function useReminderTaps(): void {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const gameId = response.notification.request.content.data?.gameId;
    if (typeof gameId === "string") router.push({ pathname: "/game/[id]", params: { id: gameId } });
  }, [response, router]);
}
