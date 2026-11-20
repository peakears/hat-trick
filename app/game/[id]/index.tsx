import { Stack, useLocalSearchParams, useRouter, type ErrorBoundaryProps } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { GameSide } from "../../../src/domain";
import { RevealButton } from "../../../src/ui/components/ShieldUi";
import { CrashScreen, Empty, ErrorView, Loading, OfflineBanner, UpdatedAt } from "../../../src/ui/components/States";
import { TeamLogo } from "../../../src/ui/components/TeamLogo";
import { GoalSummary } from "../../../src/ui/components/GoalSummary";
import { WhereToWatch } from "../../../src/ui/components/WhereToWatch";
import { teamRecord, venueLabel } from "../../../src/ui/format";
import { useSpoilers } from "../../../src/ui/spoiler-context";
import { LEAGUE, useSportsData } from "../../../src/ui/sports-data-context";
import { tabular, useColors } from "../../../src/ui/theme";
import { usePolled } from "../../../src/ui/use-polled";

/** A game page that fails to render keeps the header, so Back still returns to the scores. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} retry={retry} />;
}

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sports = useSportsData();
  const colors = useColors();
  const spoilers = useSpoilers();
  const router = useRouter();
  const detail = usePolled(`game:${id}`, (o) => sports.getGameDetail(LEAGUE, id, o));
  // Season records come from the standings (shared with the Standings tab's cache). Optional:
  // if standings fail to load, the records are just left out.
  const standings = usePolled("standings", (o) => sports.getStandings(LEAGUE, o));

  if (detail.loading) return <Loading />;
  if (!detail.data) {
    return (
      <ErrorView
        title="Couldn't load this game"
        error={detail.error ?? new Error("Unknown error")}
        onRetry={detail.refresh}
      />
    );
  }

  const { game, goals } = detail.data;
  const live = game.status === "live";
  const venue = venueLabel(game.venue);
  // While hidden: no score, shots, box score, and no records (the standings already count a finished game).
  const hidden = spoilers.isHidden(game);

  const team = (s: GameSide) => {
    const record = hidden && game.status === "final" ? undefined : teamRecord(standings.data, s.team);
    return (
      <View style={styles.team}>
        <Pressable
          onPress={() => router.push({ pathname: "/team/[id]", params: { id: s.team.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${s.team.name}, open team page`}
          style={styles.teamLink}
        >
          <TeamLogo team={s.team} size={56} />
          <Text style={[styles.teamName, { color: colors.text }]} numberOfLines={1}>
            {s.team.name}
          </Text>
        </Pressable>
        {record && (
          <Text
            style={[styles.record, tabular, { color: colors.muted }]}
            accessibilityLabel={`Season record ${record}`}
          >
            {record}
          </Text>
        )}
        {s.shotsOnGoal !== undefined && !hidden && (
          // A pill, so shots read as a live game stat rather than another line of team info.
          <View
            style={[styles.sogPill, { backgroundColor: colors.background, borderColor: colors.border }]}
            accessibilityLabel={`${s.shotsOnGoal} shots on goal`}
          >
            <Text style={[styles.sogValue, tabular, { color: colors.text }]}>{s.shotsOnGoal}</Text>
            <Text style={[styles.sogLabel, { color: colors.muted }]}>SOG</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: `${game.away.team.abbrev} @ ${game.home.team.abbrev}` }} />
      <OfflineBanner meta={detail.meta} />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={detail.refreshing} onRefresh={detail.refresh} colors={[colors.accent]} />
        }
      >
        <View style={[styles.summary, { backgroundColor: colors.card }]}>
          {team(game.away)}
          <View style={styles.middle}>
            {hidden ? (
              <Text style={[styles.hiddenScore, { color: colors.muted }]}>Score hidden</Text>
            ) : (
              <Text style={[styles.score, tabular, { color: colors.text }]}>
                {game.away.score ?? "-"} – {game.home.score ?? "-"}
              </Text>
            )}
            <Text style={[styles.status, tabular, { color: live ? colors.live : colors.muted }]}>
              {spoilers.statusLabel(game)}
            </Text>
            {hidden && <RevealButton label="Show score" onPress={() => spoilers.reveal(game.id)} />}
          </View>
          {team(game.home)}
        </View>

        {venue && (
          <Text style={[styles.venue, { color: colors.muted }]} accessibilityLabel={`Played at ${venue}`}>
            {venue}
          </Text>
        )}

        <WhereToWatch game={game} />

        {!hidden && goals && <GoalSummary goals={goals} />}

        {game.status === "scheduled" ? (
          <Empty message="Box score starts at puck drop." />
        ) : (
          <Pressable
            onPress={() => router.push({ pathname: "/game/[id]/box-score", params: { id: game.id } })}
            accessibilityRole="button"
            accessibilityLabel="Open box score"
            style={[styles.boxScoreRow, { backgroundColor: colors.card }]}
          >
            <Text style={[styles.boxScoreLabel, { color: colors.text }]}>Box score</Text>
            <Text style={[styles.boxScoreHint, { color: colors.muted }]}>Player stats ›</Text>
          </Pressable>
        )}
        <UpdatedAt meta={detail.meta} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  boxScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
  },
  venue: { fontSize: 13, textAlign: "center", marginTop: 10, marginHorizontal: 12 },
  boxScoreLabel: { fontSize: 15, fontWeight: "700" },
  boxScoreHint: { fontSize: 13 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  team: { flex: 1, alignItems: "center", gap: 6 },
  teamLink: { alignItems: "center", gap: 6, maxWidth: "100%" },
  teamName: { flexShrink: 1, fontSize: 14, fontWeight: "600" },
  record: { fontSize: 12, fontWeight: "600" },
  sogPill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sogValue: { fontSize: 14, fontWeight: "700" },
  sogLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 0.5 },
  middle: { alignItems: "center", paddingHorizontal: 8, gap: 4 },
  score: { fontSize: 30, fontWeight: "800" },
  hiddenScore: { fontSize: 16, fontWeight: "600" },
  status: { fontSize: 13, fontWeight: "600" },
});
