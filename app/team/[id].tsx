import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter, type ErrorBoundaryProps } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Game, StandingRow, TeamDetail } from "../../src/domain";
import { FavoriteStar } from "../../src/ui/components/FavoriteStar";
import { NextGameCard } from "../../src/ui/components/NextGameCard";
import { StatTableView } from "../../src/ui/components/StatTableView";
import { CrashScreen, Empty, ErrorView, OfflineBanner, UpdatedAt } from "../../src/ui/components/States";
import { ListSkeleton, PageSkeleton } from "../../src/ui/components/Skeleton";
import { SpecialEventTag } from "../../src/ui/components/SpecialEventTag";
import { TeamLogo } from "../../src/ui/components/TeamLogo";
import { dateLabel, localDate, recordLabel } from "../../src/ui/format";
import { pickNextGame, withoutNextGame, type NextGame } from "../../src/ui/next-game";
import { useSpoilers } from "../../src/ui/spoiler-context";
import { LEAGUE, useSportsData } from "../../src/ui/sports-data-context";
import {
  findStandingRow,
  goalDifferentialLabel,
  rankLine,
  splitLines,
  teamGameLine,
  teamGameSpoken,
  visibleGames,
} from "../../src/ui/team";
import { tabular, useColors, DIVIDER } from "../../src/ui/theme";
import { usePolled } from "../../src/ui/use-polled";
import { useScoresToday } from "../../src/ui/use-today";

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

/** One game as a single line from this team's side: date, opponent, and the result, live score or start time. */
function CompactGame({ game, teamId, today }: { game: Game; teamId: string; today: string }) {
  const colors = useColors();
  const router = useRouter();
  const spoilers = useSpoilers();
  const line = teamGameLine(game, teamId, spoilers.isHidden(game));
  const date = dateLabel(localDate(new Date(game.startTime)), today);
  const live = game.status === "live";

  let outcome;
  if (line.result) {
    const { won, score, endedIn } = line.result;
    outcome = (
      <Text style={[styles.gameOutcome, tabular, { color: won ? colors.text : colors.muted }]}>
        <Text style={styles.bold}>{won ? "W" : "L"}</Text> {score}
        {endedIn ? ` ${endedIn}` : ""}
      </Text>
    );
  } else {
    // Start time, live clock, "Final" while shielded, or "Postponed".
    const status = spoilers.statusLabel(game);
    outcome = (
      <Text style={[styles.gameOutcome, tabular, { color: live ? colors.live : colors.muted }]}>
        {line.liveScore ? `${line.liveScore} · ${status}` : status}
      </Text>
    );
  }

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/game/[id]", params: { id: game.id } })}
      style={({ pressed }) => [styles.gameRow, { opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`${date}, ${teamGameSpoken(line)}${game.specialEvent ? `, ${game.specialEvent}` : ""}${line.result || line.liveScore ? "" : `, ${spoilers.statusLabel(game)}`}. Open game`}
    >
      <Text style={[styles.gameDate, { color: colors.muted }]} numberOfLines={1}>
        {date}
      </Text>
      <Text style={[styles.gameWhere, { color: colors.muted }]}>{line.home ? "vs" : "@"}</Text>
      <TeamLogo team={line.opponent} size={22} />
      {/* The event (from the team's schedule) goes under the opponent, keeping the row's columns lined up. */}
      <View style={styles.gameOpponentBox}>
        <Text style={[styles.gameOpponent, { color: colors.text }]} numberOfLines={1}>
          {line.opponent.name}
        </Text>
        <SpecialEventTag name={game.specialEvent} style={styles.gameEvent} />
      </View>
      {outcome}
    </Pressable>
  );
}

/** Recent or upcoming games in one compact card: three at first, the rest behind "Show more". Nothing when there are none. */
function GamesSection({ title, games, teamId }: { title: string; games?: Game[]; teamId: string }) {
  const colors = useColors();
  const today = useScoresToday();
  const [expanded, setExpanded] = useState(false);
  if (!games || games.length === 0) return null;
  const { shown, more } = visibleGames(games, expanded);
  const canToggle = expanded || more > 0;
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title}</Text>
      <View style={[styles.gamesCard, { backgroundColor: colors.card }]}>
        {shown.map((g, i) => (
          <View key={g.id} style={i > 0 && { borderTopColor: colors.border, borderTopWidth: DIVIDER }}>
            <CompactGame game={g} teamId={teamId} today={today} />
          </View>
        ))}
        {canToggle && (
          <Pressable
            onPress={() => setExpanded(!expanded)}
            hitSlop={8}
            style={[styles.toggle, { borderTopColor: colors.border }]}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={
              expanded ? `Show fewer ${title.toLowerCase()}` : `Show ${more} more ${title.toLowerCase()}`
            }
          >
            <Text style={[styles.toggleText, { color: colors.accent }]}>
              {expanded ? "Show fewer" : `Show ${more} more`}
            </Text>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.accent} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * The parts that need their own request (games and player stats). They load after the header, so a
 * slow or failed request never hides the standings numbers above.
 */
function TeamExtras({
  teamId,
  data,
  next,
  loading,
  error,
  onRetry,
}: {
  teamId: string;
  data?: TeamDetail;
  /** The game in the next game card, left out of the list it came from. */
  next?: NextGame;
  loading: boolean;
  error?: Error;
  onRetry: () => void;
}) {
  const colors = useColors();
  if (!data) {
    if (loading) return <ListSkeleton rows={3} />;
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
      <GamesSection title="Recent games" games={withoutNextGame(data.recent, next, "recent")} teamId={teamId} />
      <GamesSection title="Upcoming games" games={withoutNextGame(data.upcoming, next, "upcoming")} teamId={teamId} />
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

  if (standings.loading) return <PageSkeleton avatar={96} />;
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
  // From the team's schedule; no card in the offseason or when the schedule failed to load.
  const next = pickNextGame(detail.data);

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
          <TeamLogo team={team} size={96} />
          <View style={styles.headerText}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
              {team.name}
            </Text>
            <Text style={[styles.rankLine, { color: colors.muted }]}>{rankLine(row)}</Text>
            {detail.data?.arena && (
              <Text style={[styles.rankLine, { color: colors.muted }]} numberOfLines={1}>
                {detail.data.arena}
              </Text>
            )}
          </View>
          <View style={styles.star}>
            <FavoriteStar team={team} size={26} />
          </View>
        </View>

        {next && <NextGameCard game={next.game} teamId={team.id} standings={standings.data} />}

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
                style={[styles.splitRow, i > 0 && { borderTopColor: colors.border, borderTopWidth: DIVIDER }]}
              >
                <Text style={[styles.splitLabel, { color: colors.muted }]}>{s.label}</Text>
                <Text style={[styles.splitRecord, tabular, { color: colors.text }]}>{s.record}</Text>
                {s.goals && <Text style={[styles.splitGoals, tabular, { color: colors.muted }]}>{s.goals}</Text>}
              </View>
            ))}
          </View>
        )}
        <TeamExtras
          teamId={team.id}
          data={detail.data}
          next={next}
          loading={detail.loading}
          error={detail.error}
          onRetry={detail.refresh}
        />
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
  tiles: { flexDirection: "row", alignSelf: "stretch", borderTopWidth: DIVIDER, paddingVertical: 12 },
  tile: { flex: 1, alignItems: "center" },
  tileValue: { fontSize: 18, fontWeight: "700" },
  tileLabel: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  card: { margin: 12, borderRadius: 12, paddingHorizontal: 14 },
  splitRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  splitLabel: { width: 64, fontSize: 13, fontWeight: "600" },
  splitRecord: { fontSize: 16, fontWeight: "700" },
  splitGoals: { flex: 1, textAlign: "right", fontSize: 12 },
  // The same gap above and below every section title, whatever card follows it.
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  gamesCard: { marginHorizontal: 12, borderRadius: 12, paddingHorizontal: 12 },
  gameRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  gameDate: { width: 86, fontSize: 13 },
  gameWhere: { width: 20, fontSize: 13, textAlign: "center" },
  gameOpponentBox: { flex: 1 },
  gameOpponent: { fontSize: 14, fontWeight: "600" },
  gameEvent: { fontSize: 10, marginTop: 1 },
  gameOutcome: { fontSize: 14, textAlign: "right" },
  bold: { fontWeight: "800" },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: DIVIDER,
  },
  toggleText: { fontSize: 13, fontWeight: "600" },
  errorCard: { padding: 14, gap: 6 },
  errorText: { fontSize: 15, fontWeight: "600" },
  errorDetail: { fontSize: 13 },
  retry: { fontSize: 15, fontWeight: "700", marginTop: 4 },
  none: { fontSize: 14, marginHorizontal: 16, marginVertical: 12 },
});
