import { useRouter } from "expo-router";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import type { StandingRow } from "../../src/domain";
import { Segmented } from "../../src/ui/components/Segmented";
import { ErrorView, OfflineBanner, UpdatedAt } from "../../src/ui/components/States";
import { ListSkeleton } from "../../src/ui/components/Skeleton";
import { TeamLogo } from "../../src/ui/components/TeamLogo";
import { favoritesFor, isFavorite } from "../../src/ui/team/favorites";
import { statValue } from "../../src/ui/common/format";
import { teamRoute } from "../../src/ui/common/routes";
import { useSettings } from "../../src/ui/settings/settings-context";
import { useSportsData } from "../../src/ui/data/sports-data-context";
import { useLeague } from "../../src/ui/data/use-league";
import {
  availableStandingsViews,
  effectiveStandingsView,
  STANDINGS_VIEW_LABELS,
  standingsSections,
} from "../../src/ui/standings/standings";
import { tabular, useColors, DIVIDER } from "../../src/ui/theme/theme";
import { usePolled } from "../../src/ui/data/use-polled";

const NUM_WIDTH = 28;

// Streaks can be three characters ("OT2", "W10"), so that column is wider than the counts.
const COLUMNS: { label: string; width: number; value: (r: StandingRow) => string | number | undefined }[] = [
  { label: "GP", width: NUM_WIDTH, value: (r) => r.gamesPlayed },
  { label: "W", width: NUM_WIDTH, value: (r) => r.wins },
  { label: "L", width: NUM_WIDTH, value: (r) => r.losses },
  { label: "OTL", width: NUM_WIDTH, value: (r) => r.otLosses },
  { label: "PTS", width: NUM_WIDTH, value: (r) => r.points },
  // Basketball: win percentage (".647") and games behind the conference leader ("-" for the leader).
  { label: "PCT", width: 40, value: (r) => (r.winPercent === undefined ? undefined : statValue(r.winPercent)) },
  {
    label: "GB",
    width: 32,
    value: (r) => (r.gamesBehind === undefined ? undefined : r.gamesBehind === 0 ? "-" : String(r.gamesBehind)),
  },
  { label: "STRK", width: 36, value: (r) => r.streak },
];

export default function StandingsScreen() {
  const sports = useSportsData();
  const league = useLeague();
  const colors = useColors();
  const router = useRouter();
  const { settings, update } = useSettings();
  const standings = usePolled(`${league}:standings`, (o) => sports.getStandings(league, o));
  const favorites = favoritesFor(league, settings.favoriteTeams);
  // Only leagues with a team page open one.
  const opensTeam = sports.supports(league, "team");

  if (standings.loading) return <ListSkeleton />;
  if (!standings.data && standings.error) {
    return <ErrorView title="Couldn't load standings" error={standings.error} onRetry={standings.refresh} />;
  }

  // Leagues without hockey-style OT losses or points: hide those columns rather than show dashes.
  const rows = standings.data?.groups.flatMap((g) => g.rows) ?? [];
  const columns = COLUMNS.filter((c) => rows.some((r) => c.value(r) !== undefined));
  const views = availableStandingsViews(standings.data);
  const view = effectiveStandingsView(standings.data, settings.standingsView);
  const sections = standingsSections(standings.data, view);

  return (
    <View style={styles.screen}>
      {views.length > 1 && (
        <Segmented
          options={views.map((v) => ({ value: v, label: STANDINGS_VIEW_LABELS[v] }))}
          value={view}
          onChange={(standingsView) => update({ standingsView })}
        />
      )}
      <OfflineBanner meta={standings.meta} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.row.team.id}
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl refreshing={standings.refreshing} onRefresh={standings.refresh} colors={[colors.accent]} />
        }
        renderSectionHeader={({ section }) => (
          <View style={{ backgroundColor: colors.background }}>
            {section.conference && (
              <Text accessibilityRole="header" style={[styles.conference, { color: colors.accent }]}>
                {section.conference}
              </Text>
            )}
            <View style={[styles.row, styles.headerRow, section.conference && styles.underConference]}>
              <Text accessibilityRole="header" style={[styles.groupName, { color: colors.text }]}>
                {section.title}
              </Text>
              {columns.map((c) => (
                <Text key={c.label} style={[styles.num, styles.headerText, { width: c.width, color: colors.muted }]}>
                  {c.label}
                </Text>
              ))}
            </View>
          </View>
        )}
        renderItem={({ item: { row: item, rank, band, bandStart }, index, section }) => {
          // Wild card view: a heavier line under the last team in a playoff spot.
          const lastIn = section.playoffLine === index + 1 && index + 1 < section.data.length;
          // Conference view with the league's bands (NBA: playoffs, play-in, out): the band's name, said with the seed.
          const bandLabel = band !== undefined ? standings.data?.conferenceBands?.[band]?.label : undefined;
          return (
            <View>
              {bandStart && (
                <View
                  style={[styles.band, { backgroundColor: colors.surfaceSunken, borderTopColor: colors.cardBorder }]}
                >
                  <Text style={[styles.bandText, { color: colors.muted }]} importantForAccessibility="no">
                    {bandStart.toUpperCase()}
                  </Text>
                </View>
              )}
              <Pressable
                onPress={opensTeam ? () => router.push(teamRoute(item.team)) : undefined}
                disabled={!opensTeam}
                accessibilityRole={opensTeam ? "button" : undefined}
                accessibilityLabel={`${item.team.name}${bandLabel ? `, seed ${rank}, ${bandLabel}` : ""}${lastIn ? ", last wild card spot" : ""}${opensTeam ? ", open team page" : ""}`}
                style={[
                  styles.row,
                  styles.teamRow,
                  {
                    backgroundColor: colors.card,
                    borderBottomColor: lastIn ? colors.muted : colors.border,
                    // A favourite team gets an accent bar on the left edge.
                    borderLeftColor: isFavorite(favorites, item.team.id) ? colors.accent : "transparent",
                  },
                  lastIn && styles.playoffLine,
                ]}
              >
                {/* The best band's seeds in the accent colour, the rest muted. */}
                <Text
                  style={[
                    styles.rank,
                    tabular,
                    { color: band === 0 ? colors.accent : colors.muted },
                    band === 0 && styles.bold,
                  ]}
                >
                  {rank}
                </Text>
                <TeamLogo team={item.team} size={24} />
                {/* Two lines, so long names ("Golden Knights") wrap on narrow screens instead of being cut off. */}
                <Text numberOfLines={2} style={[styles.team, { color: colors.text }]}>
                  {item.team.name}
                </Text>
                {columns.map((c) => (
                  <Text
                    key={c.label}
                    style={[
                      styles.num,
                      tabular,
                      { width: c.width, color: colors.text },
                      c.label === "PTS" && styles.bold,
                    ]}
                  >
                    {c.value(item) ?? "-"}
                  </Text>
                ))}
              </Pressable>
            </View>
          );
        }}
        ListFooterComponent={<UpdatedAt meta={standings.meta} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 4,
    borderBottomWidth: DIVIDER,
    borderBottomColor: "transparent",
  },
  teamRow: { borderLeftWidth: 3 },
  playoffLine: { borderBottomWidth: 2 },
  band: { paddingHorizontal: 12, paddingVertical: 4, borderTopWidth: 1 },
  bandText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  headerRow: { paddingTop: 16 },
  conference: {
    paddingHorizontal: 12,
    paddingTop: 20,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  underConference: { paddingTop: 6 },
  groupName: { flex: 1, fontSize: 15, fontWeight: "700" },
  headerText: { fontSize: 11, fontWeight: "700" },
  rank: { width: 20, textAlign: "right", fontSize: 13 },
  team: { flex: 1, fontSize: 15, paddingLeft: 4 },
  num: { textAlign: "right", fontSize: 14 },
  bold: { fontWeight: "700" },
});
