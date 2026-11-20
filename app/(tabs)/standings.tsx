import { useState } from "react";
import { RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import type { StandingRow } from "../../src/domain";
import { FavoriteStar } from "../../src/ui/components/FavoriteStar";
import { Segmented } from "../../src/ui/components/Segmented";
import { ErrorView, Loading, OfflineBanner, UpdatedAt } from "../../src/ui/components/States";
import { TeamLogo } from "../../src/ui/components/TeamLogo";
import { isFavorite } from "../../src/ui/favorites";
import { signedNumber } from "../../src/ui/format";
import { useSettings } from "../../src/ui/settings-context";
import { LEAGUE, useSportsData } from "../../src/ui/sports-data-context";
import { tabular, useColors } from "../../src/ui/theme";
import { usePolled } from "../../src/ui/use-polled";

const NUM_WIDTH = 28;

interface Column {
  label: string;
  width: number;
  value: (r: StandingRow) => string | number | undefined;
}

// Streaks can be three characters ("OT2", "W10"), last 10 is "8-1-1" and a goal difference "+30", so those
// columns are wider than the counts.
const COLUMNS: Record<string, Column> = {
  GP: { label: "GP", width: NUM_WIDTH, value: (r) => r.gamesPlayed },
  W: { label: "W", width: NUM_WIDTH, value: (r) => r.wins },
  L: { label: "L", width: NUM_WIDTH, value: (r) => r.losses },
  OT: { label: "OT", width: NUM_WIDTH, value: (r) => r.otLosses },
  PTS: { label: "PTS", width: NUM_WIDTH, value: (r) => r.points },
  L10: { label: "L10", width: 40, value: (r) => r.last10 },
  DIFF: {
    label: "DIFF",
    width: 36,
    value: (r) => (r.goalDifferential === undefined ? undefined : signedNumber(r.goalDifferential)),
  },
  STRK: { label: "STRK", width: 36, value: (r) => r.streak },
};

// Eight columns do not fit next to a team name on a phone, so the table has two views of the same width:
// the season record, and recent form.
type StandingsView = "record" | "form";
const VIEWS: Record<StandingsView, string[]> = {
  record: ["GP", "W", "L", "OT", "PTS", "STRK"],
  form: ["GP", "PTS", "L10", "DIFF", "STRK"],
};
const VIEW_OPTIONS: { value: StandingsView; label: string }[] = [
  { value: "record", label: "Record" },
  { value: "form", label: "Form" },
];

export default function StandingsScreen() {
  const sports = useSportsData();
  const colors = useColors();
  const { settings } = useSettings();
  const standings = usePolled("standings", (o) => sports.getStandings(LEAGUE, o));
  const [view, setView] = useState<StandingsView>("record");

  if (standings.loading) return <Loading />;
  if (!standings.data && standings.error) {
    return <ErrorView title="Couldn't load standings" error={standings.error} onRetry={standings.refresh} />;
  }

  // Leagues without hockey-style OT losses or points: hide those columns rather than show dashes.
  const rows = standings.data?.groups.flatMap((g) => g.rows) ?? [];
  const columns = VIEWS[view].map((key) => COLUMNS[key]).filter((c) => rows.some((r) => c.value(r) !== undefined));
  const sections = (standings.data?.groups ?? []).map((g) => ({ title: g.name, data: g.rows }));

  return (
    <View style={styles.screen}>
      <OfflineBanner meta={standings.meta} />
      <Segmented options={VIEW_OPTIONS} value={view} onChange={setView} />
      <SectionList
        sections={sections}
        keyExtractor={(r) => r.team.id}
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl refreshing={standings.refreshing} onRefresh={standings.refresh} colors={[colors.accent]} />
        }
        renderSectionHeader={({ section }) => (
          <View style={[styles.row, styles.headerRow, { backgroundColor: colors.background }]}>
            <Text style={[styles.groupName, { color: colors.text }]}>{section.title}</Text>
            {columns.map((c) => (
              <Text key={c.label} style={[styles.num, styles.headerText, { width: c.width, color: colors.muted }]}>
                {c.label}
              </Text>
            ))}
          </View>
        )}
        renderItem={({ item }) => (
          <View
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
            <Text style={[styles.rank, tabular, { color: colors.muted }]}>{item.rank}</Text>
            <FavoriteStar team={item.team} size={20} />
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
          </View>
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
  groupName: { flex: 1, fontSize: 15, fontWeight: "700" },
  headerText: { fontSize: 11, fontWeight: "700" },
  rank: { width: 20, textAlign: "right", fontSize: 13 },
  team: { flex: 1, fontSize: 15, paddingLeft: 4 },
  num: { textAlign: "right", fontSize: 14 },
  bold: { fontWeight: "700" },
});
