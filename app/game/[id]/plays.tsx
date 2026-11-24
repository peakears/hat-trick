import { Stack, useLocalSearchParams, type ErrorBoundaryProps } from "expo-router";
import { useState } from "react";
import { RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { PlayRow } from "../../../src/ui/components/PlayRow";
import { RevealButton } from "../../../src/ui/components/ShieldUi";
import { Segmented } from "../../../src/ui/components/Segmented";
import { CrashScreen, Empty, ErrorView, OfflineBanner, UpdatedAt } from "../../../src/ui/components/States";
import { ListSkeleton } from "../../../src/ui/components/Skeleton";
import { playPeriodLabels, playPeriods, type PlayFilter } from "../../../src/ui/game/plays";
import { useSpoilers } from "../../../src/ui/spoilers/spoiler-context";
import { useSportsData } from "../../../src/ui/data/sports-data-context";
import { usePageLeague } from "../../../src/ui/data/use-page-league";
import { useColors } from "../../../src/ui/theme/theme";
import { usePolled } from "../../../src/ui/data/use-polled";

/** A play-by-play that fails to render keeps the header, so Back still returns to the game. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} retry={retry} />;
}

/** The period tab that shows every period. */
const ALL = "all";

/**
 * Every play of a game, grouped by period: newest first while it is live, in order once it is over. Tabs pick one
 * period or all of them, and a switch keeps only goals and penalties. Opened from the game page's play-by-play card,
 * whose cache entry it shares, so opening it costs no request.
 */
export default function PlaysScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sports = useSportsData();
  const colors = useColors();
  const spoilers = useSpoilers();
  const [filter, setFilter] = useState<PlayFilter>("all");
  const [period, setPeriod] = useState<string>(ALL);
  const league = usePageLeague();
  const plays = usePolled(`${league}:plays:${id}`, (o) => sports.getPlays(league, id, o));

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

  const labels = playPeriodLabels(plays.data.plays);
  // A picked period that is not in this game (it changed under the tabs) shows them all.
  const shownPeriod = labels.includes(period) ? period : ALL;
  const periods = playPeriods(plays.data.plays, { filter, newestFirst: game.status === "live" }).filter(
    (p) => shownPeriod === ALL || p.label === shownPeriod,
  );
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
          <>
            {labels.length > 1 && (
              <Segmented
                options={[{ value: ALL, label: "All" }, ...labels.map((l) => ({ value: l, label: l }))]}
                value={shownPeriod}
                onChange={setPeriod}
              />
            )}
            <View style={labels.length > 1 && styles.filter}>
              <Segmented
                options={[
                  { value: "all", label: "All plays" },
                  { value: "key", label: "Goals and penalties" },
                ]}
                value={filter}
                onChange={setFilter}
              />
            </View>
          </>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[styles.period, { color: colors.muted, backgroundColor: colors.background }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item, index }) => (
          <PlayRow play={item} game={game} first={index === 0} style={[styles.row, { backgroundColor: colors.card }]} />
        )}
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

const styles = StyleSheet.create({
  hidden: { alignItems: "center", gap: 8 },
  // The second switch sits close under the period tabs, so the two read as one set of controls.
  filter: { marginTop: -8 },
  period: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: { marginHorizontal: 12, paddingHorizontal: 12 },
});
