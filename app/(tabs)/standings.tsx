import { useRouter } from "expo-router";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import type { StandingRow } from "../../src/domain";
import { Segmented } from "../../src/ui/components/Segmented";
import { ErrorView, Loading, OfflineBanner, UpdatedAt } from "../../src/ui/components/States";
import { TeamLogo } from "../../src/ui/components/TeamLogo";
import { isFavorite } from "../../src/ui/favorites";
import { useSettings } from "../../src/ui/settings-context";
import { LEAGUE, useSportsData } from "../../src/ui/sports-data-context";
import {
  availableStandingsViews,
  effectiveStandingsView,
  STANDINGS_VIEW_LABELS,
  standingsSections,
} from "../../src/ui/standings";
import { tabular, useColors } from "../../src/ui/theme";
import { usePolled } from "../../src/ui/use-polled";

const NUM_WIDTH = 28;

// Streaks can be three characters ("OT2", "W10"), so that column is wider than the counts.
const COLUMNS: { label: string; width: number; value: (r: StandingRow) => string | number | undefined }[] = [
  { label: "GP", width: NUM_WIDTH, value: (r) => r.gamesPlayed },
  { label: "W", width: NUM_WIDTH, value: (r) => r.wins },
  { label: "L", width: NUM_WIDTH, value: (r) => r.losses },
  { label: "OT", width: NUM_WIDTH, value: (r) => r.otLosses },
  { label: "PTS", width: NUM_WIDTH, value: (r) => r.points },
  { label: "STRK", width: 36, value: (r) => r.streak },
];

export default function StandingsScreen() {
  const sports = useSportsData();
  const colors = useColors();
  const router = useRouter();
  const { settings, update } = useSettings();
  const standings = usePolled("standings", (o) => sports.getStandings(LEAGUE, o));

  if (standings.loading) return <Loading />;
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
        renderItem={({ item: { row: item, rank } }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/team/[id]", params: { id: item.team.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${item.team.name}, open team page`}
            style={[
              styles.row,
              styles.teamRow,
              {
                backgroundColor: colors.card,
                borderBottomColor: colors.border,
                // A favourite team gets an accent bar on the left edge.
                borderLeftColor: isFavorite(settings.favoriteTeams, item.team.id) ? colors.accent : "transparent",
              },
            ]}
          >
            <Text style={[styles.rank, tabular, { color: colors.muted }]}>{rank}</Text>
            <TeamLogo team={item.team} size={24} />
            {/* Two lines, so long names ("Golden Knights") wrap on narrow screens instead of being cut off. */}
            <Text numberOfLines={2} style={[styles.team, { color: colors.text }]}>
              {item.team.name}
            </Text>
            {columns.map((c) => (
              <Text
                key={c.label}
                style={[styles.num, tabular, { width: c.width, color: colors.text }, c.label === "PTS" && styles.bold]}
              >
                {c.value(item) ?? "-"}
              </Text>
            ))}
          </Pressable>
        )}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "transparent",
  },
  teamRow: { borderLeftWidth: 3 },
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
