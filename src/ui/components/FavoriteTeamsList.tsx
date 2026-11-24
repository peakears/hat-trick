import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LeagueId, Team } from "../../domain";
import { teamRoute } from "../common/routes";
import { useSportsData } from "../data/sports-data-context";
import { usePolled } from "../data/use-polled";
import { liveTrackingAvailable } from "../notifications/live-tracker-native";
import { alertsOn, setAlert, type AlertKind } from "../notifications/team-alerts";
import { useSettings } from "../settings/settings-context";
import { favoriteKey, favoritesFor, leaguesWithFavorites } from "../team/favorites";
import { findStandingRow } from "../team/team";
import { leagueTint } from "../theme/palette";
import { DIVIDER, useColors, useScheme } from "../theme/theme";
import { ToggleRow } from "./SettingsRows";
import { TeamLogo } from "./TeamLogo";

/**
 * The Favourite teams page (Settings › Favourite teams): one card per team, grouped under each league's heading. A
 * card has the team's logo and name (from the Standings tab's cached standings, so no extra request once that tab
 * has loaded; the abbreviation until then), opening its team page, then a labelled switch for this team's game start
 * reminders and one for its live scores, and a Remove button. A switch stays in place, greyed out with a hint, while
 * its main switch is off, so the page never changes shape.
 *
 * `inSetup`: first-run setup's Notifications step, under its main switches. The hints point "above", the cards sit
 * flush in the step's own padding, and the empty state points back to the team step.
 */
export function FavoriteTeamsList({ inSetup = false }: { inSetup?: boolean }) {
  const colors = useColors();
  const { settings } = useSettings();
  const leagues = leaguesWithFavorites(settings.favoriteTeams);

  if (leagues.length === 0) {
    return (
      <View
        style={[
          styles.card,
          styles.empty,
          inSetup && styles.flush,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No favourite teams yet</Text>
        <Text style={[styles.hint, { color: colors.muted }]}>
          {inSetup
            ? "Go back a step to pick teams. Reminders and live scores are for their games."
            : "Star a team on its team page. Their games show first on Scores, and each team can have reminders and live scores."}
        </Text>
      </View>
    );
  }
  return (
    <>
      {leagues.map((league) => (
        <LeagueFavorites key={league} league={league} inSetup={inSetup} />
      ))}
      {!inSetup && (
        <Text style={[styles.footnote, { color: colors.muted }]}>
          Star a team on its team page to add it. Their games show first on Scores.
        </Text>
      )}
    </>
  );
}

/** One league's favourites. Its own component, so each league reads its own standings (one usePolled each). */
function LeagueFavorites({ league, inSetup }: { league: LeagueId; inSetup: boolean }) {
  const colors = useColors();
  const scheme = useScheme();
  const sports = useSportsData();
  const { settings } = useSettings();
  const standings = usePolled(`${league}:standings`, (o) => sports.getStandings(league, o));
  const ids = favoritesFor(league, settings.favoriteTeams);

  return (
    <View style={styles.league}>
      <View style={[styles.leagueHead, inSetup && styles.leagueHeadFlush]} accessible accessibilityRole="header">
        <Text style={[styles.leagueAbbrev, { color: leagueTint(league, scheme) }]}>{league.toUpperCase()}</Text>
        <Text style={[styles.leagueName, { color: colors.muted }]}>{sports.leagueName(league)}</Text>
      </View>
      {ids.map((id) => {
        const row = findStandingRow(standings.data, id);
        const team: Team = row?.team ?? { id, league, name: id, abbrev: id };
        return <FavoriteCard key={id} team={team} inSetup={inSetup} />;
      })}
    </View>
  );
}

function FavoriteCard({ team, inSetup }: { team: Team; inSetup: boolean }) {
  const colors = useColors();
  const router = useRouter();
  const sports = useSportsData();
  const { settings, update, toggleFavoriteTeam } = useSettings();
  const key = favoriteKey(team.league, team.id);
  const opens = sports.supports(team.league, "team");
  const liveAvailable = liveTrackingAvailable();
  const set = (kind: AlertKind, on: boolean) => update({ teamAlerts: setAlert(settings.teamAlerts, key, kind, on) });

  return (
    <View
      style={[styles.card, inSetup && styles.flush, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
    >
      <View style={[styles.head, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={opens ? () => router.push(teamRoute(team)) : undefined}
          disabled={!opens}
          style={styles.who}
          accessibilityRole={opens ? "button" : undefined}
          accessibilityLabel={opens ? `${team.name}, open team page` : team.name}
        >
          <TeamLogo team={team} size={36} />
          <Text numberOfLines={2} style={[styles.name, { color: colors.text }]}>
            {team.name}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => toggleFavoriteTeam(team.league, team.id)}
          hitSlop={8}
          style={styles.remove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${team.name} from favourites`}
        >
          <Text style={[styles.removeText, { color: colors.accent }]}>Remove</Text>
        </Pressable>
      </View>
      <ToggleRow
        label="Game start reminders"
        detail={
          settings.remindersEnabled
            ? "A notification before their games."
            : `Turn on Game start reminders ${inSetup ? "above" : "in Settings"} first.`
        }
        value={settings.remindersEnabled && alertsOn(settings.teamAlerts, key, "reminders")}
        onChange={(on) => set("reminders", on)}
        disabled={!settings.remindersEnabled}
      />
      <ToggleRow
        label="Live scores"
        detail={
          !liveAvailable
            ? "Available in the installed Android app (not in Expo Go)."
            : settings.liveScores
              ? "The score and scoring alerts during their games."
              : `Turn on Live scores ${inSetup ? "above" : "in Settings"} first.`
        }
        value={liveAvailable && settings.liveScores && alertsOn(settings.teamAlerts, key, "live")}
        onChange={(on) => set("live", on)}
        disabled={!liveAvailable || !settings.liveScores}
        last
      />
    </View>
  );
}

const styles = StyleSheet.create({
  league: { marginTop: 8 },
  leagueHead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
  },
  leagueAbbrev: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  leagueName: { fontSize: 12 },
  card: { marginHorizontal: 12, marginBottom: 10, borderRadius: 12, borderWidth: DIVIDER, overflow: "hidden" },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 8,
    borderBottomWidth: DIVIDER,
  },
  who: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0, paddingVertical: 10 },
  name: { flex: 1, fontSize: 17, fontWeight: "600" },
  remove: { minHeight: 44, paddingHorizontal: 10, justifyContent: "center" },
  removeText: { fontSize: 14, fontWeight: "600" },
  empty: { padding: 16, gap: 6, marginTop: 16 },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  hint: { fontSize: 13 },
  // In setup: the step already has its own side padding.
  flush: { marginHorizontal: 0 },
  leagueHeadFlush: { marginHorizontal: 4 },
  footnote: { fontSize: 12, marginHorizontal: 16, marginTop: 4, marginBottom: 24 },
});
