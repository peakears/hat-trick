import { Stack, useLocalSearchParams, type ErrorBoundaryProps } from "expo-router";
import { useState } from "react";
import { RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import type { Game, Play } from "../../../src/domain";
import { RevealButton } from "../../../src/ui/components/ShieldUi";
import { Segmented } from "../../../src/ui/components/Segmented";
import { CrashScreen, Empty, ErrorView, OfflineBanner, UpdatedAt } from "../../../src/ui/components/States";
import { ListSkeleton } from "../../../src/ui/components/Skeleton";
import { TeamLogo } from "../../../src/ui/components/TeamLogo";
import { playPeriods, playScoreLabel, playSpoken, type PlayFilter } from "../../../src/ui/game/plays";
import { useSpoilers } from "../../../src/ui/spoilers/spoiler-context";
import { NHL, useSportsData } from "../../../src/ui/data/sports-data-context";
import { tabular, useColors, DIVIDER } from "../../../src/ui/theme/theme";
import { usePolled } from "../../../src/ui/data/use-polled";

/** A play-by-play that fails to render keeps the header, so Back still returns to the game. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} retry={retry} />;
}

/**
 * Every play of a game, grouped by period: newest first while it is live, in order once it is over. Its own request
 * (the play-by-play is large), loaded only while this screen is open.
 */
export default function PlaysScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sports = useSportsData();
  const colors = useColors();
  const spoilers = useSpoilers();
  const [filter, setFilter] = useState<PlayFilter>("all");
  const plays = usePolled(`plays:${id}`, (o) => sports.getPlays(NHL, id, o));

  if (plays.loading) return <ListSkeleton />;
  if (!plays.data) {
    return (
      <ErrorView
        title="Couldn't load the play-by-play"
        error={plays.error ?? new Error("Unknown error")}
        onRetry={plays.refresh}
      />
    );
  }

  const { game } = plays.data;
  const title = `${game.away.team.abbrev} @ ${game.home.team.abbrev} play-by-play`;
  const refresh = <RefreshControl refreshing={plays.refreshing} onRefresh={plays.refresh} colors={[colors.accent]} />;

  // Every play gives the score away, so the whole list hides behind the shield.
  if (spoilers.isHidden(game)) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <View style={styles.hidden}>
          <Empty message="Play-by-play hidden by the spoiler shield." />
          <RevealButton label="Show score" onPress={() => spoilers.reveal(game.id)} />
        </View>
      </>
    );
  }

  const periods = playPeriods(plays.data.plays, { filter, newestFirst: game.status === "live" });
  const sections = periods.map((p) => ({ key: p.label, title: p.label, data: p.plays }));

  return (
    <>
      <Stack.Screen options={{ title }} />
      <OfflineBanner meta={plays.meta} />
      <SectionList
        sections={sections}
        keyExtractor={(p) => p.id}
        refreshControl={refresh}
        stickySectionHeadersEnabled
        ListHeaderComponent={
          <Segmented
            options={[
              { value: "all", label: "All plays" },
              { value: "key", label: "Goals and penalties" },
            ]}
            value={filter}
            onChange={setFilter}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text style={[styles.period, { color: colors.muted, backgroundColor: colors.background }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item, index }) => <PlayRow play={item} game={game} first={index === 0} />}
        ListEmptyComponent={
          <Empty
            message={
              game.status === "scheduled"
                ? "Plays start when the game does."
                : filter === "key"
                  ? "No goals or penalties yet."
                  : "No plays yet."
            }
          />
        }
        ListFooterComponent={<UpdatedAt meta={plays.meta} />}
      />
    </>
  );
}

/** One play: time, team logo, what happened; a goal in bold with its tag and the score after it. */
function PlayRow({ play, game, first }: { play: Play; game: Game; first: boolean }) {
  const colors = useColors();
  const team = [game.away.team, game.home.team].find((t) => t.id === play.teamId);
  const score = play.kind === "score";
  const scoreLabel = playScoreLabel(play);
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.card },
        !first && { borderTopColor: colors.border, borderTopWidth: DIVIDER },
      ]}
      accessible
      accessibilityLabel={playSpoken(play)}
    >
      <Text style={[styles.time, tabular, { color: colors.muted }]}>{play.time}</Text>
      <View style={styles.logo}>{team && <TeamLogo team={team} size={20} />}</View>
      <View style={styles.main}>
        <Text
          style={[
            styles.text,
            { color: colors.text },
            score && styles.bold,
            play.kind === "other" && { color: colors.muted },
          ]}
        >
          {play.text}
        </Text>
        {play.tag && <Text style={[styles.tag, { color: colors.accent }]}>{play.tag}</Text>}
      </View>
      {scoreLabel && <Text style={[styles.score, tabular, { color: colors.text }]}>{scoreLabel}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { alignItems: "center", gap: 8 },
  period: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  time: { width: 44, fontSize: 13 },
  logo: { width: 22, alignItems: "center" },
  main: { flex: 1 },
  text: { fontSize: 14 },
  bold: { fontWeight: "700" },
  tag: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  score: { fontSize: 14, fontWeight: "700", marginLeft: 6 },
});
