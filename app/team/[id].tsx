import { Stack, useLocalSearchParams, type ErrorBoundaryProps } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Game, StandingRow, TeamDetail } from "../../src/domain";
import { FavoriteStar } from "../../src/ui/components/FavoriteStar";
import { GameCard } from "../../src/ui/components/GameCard";
import { StatTableView } from "../../src/ui/components/StatTableView";
import { CrashScreen, Empty, ErrorView, Loading, OfflineBanner, UpdatedAt } from "../../src/ui/components/States";
import { TeamLogo } from "../../src/ui/components/TeamLogo";
import { recordLabel } from "../../src/ui/format";
import { LEAGUE, useSportsData } from "../../src/ui/sports-data-context";
import { findStandingRow, goalDifferentialLabel, rankLine, splitLines } from "../../src/ui/team";
import { tabular, useColors } from "../../src/ui/theme";
import { usePolled } from "../../src/ui/use-polled";

/** A team page that fails to render keeps the header, so Back still returns to where you came from. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} retry={retry} />;
}

/** The big record numbers, each with its own label (no OT losses where the league has none). */
function recordParts(row: StandingRow): { label: string; value: number }[] {
  const parts = [
    { label: "W", value: row.wins },
    { label: "L", value: row.losses },
  ];
  return row.otLosses === undefined ? parts : [...parts, { label: "OT", value: row.otLosses }];
}

/** The smaller numbers under the record, skipping any the league does not have. */
function statTiles(row: StandingRow): { label: string; value: string }[] {
  const tiles = [
    { label: "Games", value: row.gamesPlayed.toString() },
    { label: "Points", value: row.points?.toString() },
    { label: "Streak", value: row.streak },
    {
      label: "Goal diff",
      value: row.goalDifferential === undefined ? undefined : goalDifferentialLabel(row.goalDifferential),
    },
  ];
  return tiles.filter((t): t is { label: string; value: string } => t.value !== undefined);
}

/** Recent or upcoming games, each opening the game page. Nothing when there are none. */
function GamesSection({ title, games }: { title: string; games?: Game[] }) {
  const colors = useColors();
  if (!games || games.length === 0) return null;
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title}</Text>
      {games.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
    </View>
  );
}

/**
 * The parts that need their own request (games and player stats). They load after the header, so a
 * slow or failed request never hides the standings numbers above.
 */
function TeamExtras({
  data,
  loading,
  error,
  onRetry,
}: {
  data?: TeamDetail;
  loading: boolean;
  error?: Error;
  onRetry: () => void;
}) {
  const colors = useColors();
  if (!data) {
    if (loading) return <ActivityIndicator style={styles.loader} color={colors.accent} />;
    return (
      <View style={[styles.card, styles.errorCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>Couldn't load games and player stats.</Text>
        {error && <Text style={[styles.errorDetail, { color: colors.muted }]}>{error.message}</Text>}
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.retry, { color: colors.accent }]}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <>
      <GamesSection title="Recent games" games={data.recent} />
      <GamesSection title="Upcoming games" games={data.upcoming} />
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>Season stats</Text>
      {data.stats.length === 0 ? (
        <Text style={[styles.none, { color: colors.muted }]}>No player stats yet this season.</Text>
      ) : (
        data.stats.map((table) => <StatTableView key={table.title} table={table} />)
      )}
    </>
  );
}

export default function TeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sports = useSportsData();
  const colors = useColors();
  // The standings (same cache entry as the Standings tab) hold everything shown here.
  const standings = usePolled("standings", (o) => sports.getStandings(LEAGUE, o));
  // Season stats and games are a separate request, so the header above never waits for them.
  const detail = usePolled(`team:${id}`, (o) => sports.getTeam(LEAGUE, id, o));

  if (standings.loading) return <Loading />;
  if (!standings.data) {
    return (
      <ErrorView
        title="Couldn't load this team"
        error={standings.error ?? new Error("Unknown error")}
        onRetry={standings.refresh}
      />
    );
  }

  const row = findStandingRow(standings.data, id);
  if (!row) return <Empty message="This team isn't in the standings." />;

  const { team } = row;
  const splits = splitLines(row);

  return (
    <>
      <Stack.Screen options={{ title: team.name }} />
      <OfflineBanner meta={standings.meta} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={standings.refreshing || detail.refreshing}
            onRefresh={() => {
              standings.refresh();
              detail.refresh();
            }}
            colors={[colors.accent]}
          />
        }
      >
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TeamLogo team={team} size={72} />
          <View style={styles.headerText}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
              {team.name}
            </Text>
            <Text style={[styles.rankLine, { color: colors.muted }]}>{rankLine(row)}</Text>
          </View>
          <View style={styles.star}>
            <FavoriteStar team={team} size={26} />
          </View>
        </View>

        <View style={[styles.recordCard, { backgroundColor: colors.card }]}>
          <View style={styles.recordRow} accessible accessibilityLabel={`Record ${recordLabel(row)}`}>
            {recordParts(row).map((p, i) => (
              <View key={p.label} style={styles.recordItem}>
                {i > 0 && <Text style={[styles.record, { color: colors.muted }]}>-</Text>}
                <View style={styles.recordPart}>
                  <Text style={[styles.record, tabular, { color: colors.text }]}>{p.value}</Text>
                  <Text style={[styles.recordLabel, { color: colors.muted }]}>{p.label}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={[styles.tiles, { borderTopColor: colors.border }]}>
            {statTiles(row).map((t) => (
              <View key={t.label} style={styles.tile}>
                <Text style={[styles.tileValue, tabular, { color: colors.text }]}>{t.value}</Text>
                <Text style={[styles.tileLabel, { color: colors.muted }]}>{t.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {splits.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {splits.map((s, i) => (
              <View
                key={s.label}
                style={[
                  styles.splitRow,
                  i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <Text style={[styles.splitLabel, { color: colors.muted }]}>{s.label}</Text>
                <Text style={[styles.splitRecord, tabular, { color: colors.text }]}>{s.record}</Text>
                {s.goals && <Text style={[styles.splitGoals, tabular, { color: colors.muted }]}>{s.goals}</Text>}
              </View>
            ))}
          </View>
        )}
        <TeamExtras data={detail.data} loading={detail.loading} error={detail.error} onRetry={detail.refresh} />
        <UpdatedAt meta={standings.meta} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    margin: 12,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  headerText: { flex: 1, gap: 2, paddingRight: 28 },
  star: { position: "absolute", top: 12, right: 12 },
  name: { fontSize: 22, fontWeight: "800" },
  rankLine: { fontSize: 13 },
  recordCard: { margin: 12, marginBottom: 0, paddingTop: 16, borderRadius: 12, alignItems: "center" },
  recordRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14, marginLeft: -12 },
  recordItem: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginLeft: 12 },
  recordPart: { alignItems: "center" },
  record: { fontSize: 44, fontWeight: "800" },
  recordLabel: { fontSize: 12, fontWeight: "700" },
  tiles: { flexDirection: "row", alignSelf: "stretch", borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  tile: { flex: 1, alignItems: "center" },
  tileValue: { fontSize: 18, fontWeight: "700" },
  tileLabel: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  card: { margin: 12, borderRadius: 12, paddingHorizontal: 14 },
  splitRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  splitLabel: { width: 64, fontSize: 13, fontWeight: "600" },
  splitRecord: { fontSize: 16, fontWeight: "700" },
  splitGoals: { flex: 1, textAlign: "right", fontSize: 12 },
  sectionTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", marginHorizontal: 16, marginTop: 12 },
  loader: { marginVertical: 24 },
  errorCard: { padding: 14, gap: 6 },
  errorText: { fontSize: 15, fontWeight: "600" },
  errorDetail: { fontSize: 13 },
  retry: { fontSize: 15, fontWeight: "700", marginTop: 4 },
  none: { fontSize: 14, marginHorizontal: 16, marginVertical: 12 },
});
