import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LeagueId, Team } from "../../domain";
import { teamRoute } from "../common/routes";
import { useSportsData } from "../data/sports-data-context";
import { usePolled } from "../data/use-polled";
import { alertsOn, notificationsCover, setAlert, type AlertKind } from "../notifications/team-alerts";
import { useSettings } from "../settings/settings-context";
import { favoriteKey, favoritesFor, leaguesWithFavorites } from "../team/favorites";
import { findStandingRow } from "../team/team";
import { leagueTint } from "../theme/palette";
import { DIVIDER, useColors, useScheme } from "../theme/theme";
import { TeamLogo } from "./TeamLogo";

/**
 * Settings › Favourite teams: one block per league, each team a row with its logo and name (from the Standings tab's
 * cached standings, so no extra request once that tab has loaded; the abbreviation until then). Each row can open the
 * team page, switch this team's reminders and live scores on or off (where the league has them and the main switch is
 * on), and remove the team.
 */
export function FavoriteTeamsList({ liveAvailable }: { liveAvailable: boolean }) {
  const colors = useColors();
  const { settings } = useSettings();
  const leagues = leaguesWithFavorites(settings.favoriteTeams);

  if (leagues.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No favourite teams yet</Text>
        <Text style={[styles.emptyDetail, { color: colors.muted }]}>
          Star a team on its team page. Their games show first on Scores, in every league.
        </Text>
      </View>
    );
  }
  return (
    <>
      {leagues.map((league, i) => (
        <LeagueFavorites key={league} league={league} first={i === 0} liveAvailable={liveAvailable} />
      ))}
      <Text style={[styles.footnote, { color: colors.muted }]}>
        Star a team on its team page to add it. Their games show first on Scores.
      </Text>
    </>
  );
}

/** One league's favourites. Its own component, so each league reads its own standings (one usePolled each). */
function LeagueFavorites({
  league,
  first,
  liveAvailable,
}: {
  league: LeagueId;
  first: boolean;
  liveAvailable: boolean;
}) {
  const colors = useColors();
  const scheme = useScheme();
  const sports = useSportsData();
  const { settings } = useSettings();
  const standings = usePolled(`${league}:standings`, (o) => sports.getStandings(league, o));
  const ids = favoritesFor(league, settings.favoriteTeams);
  const covered = notificationsCover(league);

  return (
    <View style={[!first && styles.leagueGap]}>
      <View style={styles.leagueHead} accessible accessibilityRole="header">
        <Text style={[styles.leagueAbbrev, { color: leagueTint(league, scheme) }]}>{league.toUpperCase()}</Text>
        <Text style={[styles.leagueName, { color: colors.muted }]}>{sports.leagueName(league)}</Text>
      </View>
      {ids.map((id, i) => {
        const row = findStandingRow(standings.data, id);
        const team: Team = row?.team ?? { id, league, name: id, abbrev: id };
        return (
          <FavoriteRow
            key={id}
            team={team}
            last={i === ids.length - 1}
            reminders={covered && settings.remindersEnabled}
            live={covered && liveAvailable && settings.liveScores}
          />
        );
      })}
      {!covered && (settings.remindersEnabled || settings.liveScores) && (
        <Text style={[styles.note, { color: colors.muted }]}>Reminders and live scores are NHL only for now.</Text>
      )}
    </View>
  );
}

function FavoriteRow({
  team,
  last,
  reminders,
  live,
}: {
  team: Team;
  last: boolean;
  /** Show the team's reminder switch (the league has reminders and they are on). */
  reminders: boolean;
  live: boolean;
}) {
  const colors = useColors();
  const router = useRouter();
  const sports = useSportsData();
  const { settings, update, toggleFavoriteTeam } = useSettings();
  const key = favoriteKey(team.league, team.id);
  const opens = sports.supports(team.league, "team");
  const toggle = (kind: AlertKind) =>
    update({ teamAlerts: setAlert(settings.teamAlerts, key, kind, !alertsOn(settings.teamAlerts, key, kind)) });

  return (
    <View style={[styles.row, !last && { borderBottomColor: colors.border, borderBottomWidth: DIVIDER }]}>
      <Pressable
        onPress={opens ? () => router.push(teamRoute(team)) : undefined}
        disabled={!opens}
        style={styles.who}
        accessibilityRole={opens ? "button" : undefined}
        accessibilityLabel={opens ? `${team.name}, open team page` : team.name}
      >
        <TeamLogo team={team} size={28} />
        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
          {team.name}
        </Text>
      </Pressable>
      {reminders && (
        <AlertSwitch
          icon="notifications"
          on={alertsOn(settings.teamAlerts, key, "reminders")}
          label={`Reminders for ${team.name}`}
          onPress={() => toggle("reminders")}
        />
      )}
      {live && (
        <AlertSwitch
          icon="pulse"
          on={alertsOn(settings.teamAlerts, key, "live")}
          label={`Live scores for ${team.name}`}
          onPress={() => toggle("live")}
        />
      )}
      <Pressable
        onPress={() => toggleFavoriteTeam(team.league, team.id)}
        hitSlop={6}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${team.name} from favourites`}
      >
        <Ionicons name="close" size={20} color={colors.muted} />
      </Pressable>
    </View>
  );
}

type IconName = ComponentProps<typeof Ionicons>["name"];

/** An icon that switches one kind of notification for one team: filled in the accent colour when on. */
function AlertSwitch({
  icon,
  on,
  label,
  onPress,
}: {
  icon: IconName;
  on: boolean;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={[styles.iconButton, on && { backgroundColor: colors.tabSelected }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
    >
      <Ionicons
        name={on ? icon : (`${icon}-outline` as IconName)}
        size={20}
        color={on ? colors.accent : colors.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  emptyTitle: { fontSize: 16 },
  emptyDetail: { fontSize: 13 },
  leagueGap: { marginTop: 8 },
  leagueHead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  leagueAbbrev: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  leagueName: { fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 16, paddingRight: 10, minHeight: 52 },
  who: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0, paddingVertical: 8 },
  name: { flex: 1, fontSize: 16 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  note: { fontSize: 12, paddingHorizontal: 16, paddingTop: 6 },
  footnote: { fontSize: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
});
