import { Stack, useLocalSearchParams, useRouter, type ErrorBoundaryProps } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Game, GameSide } from "../../../src/domain";
import { RevealButton } from "../../../src/ui/components/ShieldUi";
import { SpecialEventTag } from "../../../src/ui/components/SpecialEventTag";
import { CrashScreen, Empty, ErrorView, OfflineBanner, UpdatedAt } from "../../../src/ui/components/States";
import { PageSkeleton } from "../../../src/ui/components/Skeleton";
import { TeamLogo } from "../../../src/ui/components/TeamLogo";
import { FlashScore } from "../../../src/ui/components/FlashScore";
import { GoalSummary } from "../../../src/ui/components/GoalSummary";
import { PenaltySummary } from "../../../src/ui/components/PenaltySummary";
import { GameInfoLines } from "../../../src/ui/components/GameInfoLines";
import { ThreeStars } from "../../../src/ui/components/ThreeStars";
import { localDate, teamRecord } from "../../../src/ui/format";
import { eventWeekStart, withSpecialEvents } from "../../../src/ui/special-events";
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

  if (detail.loading) return <PageSkeleton />;
  if (!detail.data) {
    return (
      <ErrorView
        title="Couldn't load this game"
        error={detail.error ?? new Error("Unknown error")}
        onRetry={detail.refresh}
      />
    );
  }

  const { game, goals, threeStars, penalties } = detail.data;
  const live = game.status === "live";
  // While hidden: no score, shots, goals, three stars, penalties, box score, and no records (the standings already
  // count a finished game).
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
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <View style={styles.summary}>
            {team(game.away)}
            <View style={styles.middle}>
              {hidden ? (
                <Text style={[styles.hiddenScore, { color: colors.muted }]}>Score hidden</Text>
              ) : (
                <View style={styles.scoreRow}>
                  <FlashScore
                    value={game.away.score}
                    live={live}
                    style={[styles.score, tabular, { color: colors.text }]}
                  >
                    {game.away.score ?? "-"}
                  </FlashScore>
                  <Text style={[styles.score, { color: colors.text }]}>–</Text>
                  <FlashScore
                    value={game.home.score}
                    live={live}
                    style={[styles.score, tabular, { color: colors.text }]}
                  >
                    {game.home.score ?? "-"}
                  </FlashScore>
                </View>
              )}
              <Text style={[styles.status, tabular, { color: live ? colors.live : colors.muted }]}>
                {spoilers.statusLabel(game)}
              </Text>
              {hidden && <RevealButton label="Show score" onPress={() => spoilers.reveal(game.id)} />}
            </View>
            {team(game.home)}
          </View>
          {/* Arena and TV channels, one compact line each, instead of a line and a card of their own. */}
          <GameInfoLines game={game} />
        </View>

        <GameEvent game={game} />

        {!hidden && threeStars && <ThreeStars stars={threeStars} />}

        {!hidden && goals && <GoalSummary goals={goals} />}

        {!hidden && penalties && (
          <PenaltySummary penalties={penalties} goals={goals} teamIds={[game.away.team.id, game.home.team.id]} />
        )}

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

/**
 * The game's special event. A final game's landing names it; otherwise it comes from the week lookup the Scores tab
 * shares (cached for hours), so a live game's 20-second polls never ask for it again.
 */
function GameEvent({ game }: { game: Game }) {
  const sports = useSportsData();
  // The league's calendar day is the game's local date for nearly every viewer; the week lookup covers Monday to Sunday.
  const weekStart = eventWeekStart(localDate(new Date(game.startTime)));
  const events = usePolled(`events:${weekStart}`, (o) => sports.getSpecialEvents(LEAGUE, weekStart, o));
  const [withEvent] = withSpecialEvents([game], events.data);
  return <SpecialEventTag name={withEvent.specialEvent} style={styles.event} />;
}

const styles = StyleSheet.create({
  event: { textAlign: "center", marginTop: 12, marginHorizontal: 12 },
  boxScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
  },
  boxScoreLabel: { fontSize: 15, fontWeight: "700" },
  boxScoreHint: { fontSize: 13 },
  summaryCard: { margin: 12, marginBottom: 0, padding: 16, borderRadius: 12 },
  summary: { flexDirection: "row", alignItems: "center" },
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
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  score: { fontSize: 30, fontWeight: "800" },
  hiddenScore: { fontSize: 16, fontWeight: "600" },
  status: { fontSize: 13, fontWeight: "600" },
});
