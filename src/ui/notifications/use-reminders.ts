import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { addDays, scoresToday } from "../common/format";
import { planReminders } from "./reminders";
import { applyReminders, cancelAllReminders, hasReminderPermission } from "./reminders-native";
import { useSettings } from "../settings/settings-context";
import { NHL, useSportsData } from "../data/sports-data-context";
import { leaguesWithFavorites } from "../team/favorites";
import { favoritesWithAlert } from "./team-alerts";
import { gameRoute } from "../common/routes";

/** How many days ahead to look for favourite teams' games (today plus the next six). */
const LOOKAHEAD_DAYS = 7;

/**
 * Keeps the scheduled game start reminders in step with the settings and the schedule. Re-checks
 * when a setting changes and each time the app comes to the foreground, which also picks up
 * postponed or rescheduled games. Mount once, inside the settings and sports data providers.
 */
export function useReminderSync(): void {
  const sports = useSportsData();
  const { settings, loaded } = useSettings();
  const { remindersEnabled, reminderLeadMinutes } = settings;
  // Every league's favourites, less those whose reminders are switched off in Settings.
  const favoriteTeams = useMemo(
    () => favoritesWithAlert(settings.favoriteTeams, settings.teamAlerts, "reminders"),
    [settings.favoriteTeams, settings.teamAlerts],
  );
  const [foregrounded, setForegrounded] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setForegrounded((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Before the stored settings load they are defaults (reminders off), which would cancel everything.
    if (!loaded) return;
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
      // Each league with a favourite, each day: the same cache entries as the Scores tab.
      const leagues = leaguesWithFavorites(favoriteTeams).filter((l) => sports.leagues().includes(l));
      const results = await Promise.allSettled(
        leagues.flatMap((league) => dates.map((d) => sports.getScores(league, d))),
      );
      // If any day failed to load, keep what is scheduled rather than cancel reminders for games we could not see.
      if (cancelled || results.some((r) => r.status === "rejected")) return;

      const games = results.flatMap((r) => (r.status === "fulfilled" ? r.value.data : []));
      const term = (league: string) => sports.gameStartTerm(league);
      await applyReminders(planReminders(games, favoriteTeams, reminderLeadMinutes, Date.now(), term));
    }
    sync().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sports, loaded, remindersEnabled, favoriteTeams, reminderLeadMinutes, foregrounded]);
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
    const data = response.notification.request.content.data;
    const gameId = data?.gameId;
    // Reminders scheduled before they carried a league are the NHL's.
    const league = typeof data?.league === "string" ? data.league : NHL;
    if (typeof gameId === "string") router.push(gameRoute({ id: gameId, league }));
  }, [response, router]);
}
