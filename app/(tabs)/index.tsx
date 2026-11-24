import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { DatePickerButton } from "../../src/ui/components/DatePickerButton";
import { GameCard } from "../../src/ui/components/GameCard";
import { Empty, ErrorView, OfflineBanner, UpdatedAt } from "../../src/ui/components/States";
import { ScoresSkeleton } from "../../src/ui/components/Skeleton";
import { ShieldBanner } from "../../src/ui/components/ShieldBanner";
import { UpdateBanner } from "../../src/ui/components/UpdateBanner";
import { addDays, dateLabel, groupGamesForScores } from "../../src/ui/common/format";
import { useSettings } from "../../src/ui/settings/settings-context";
import { useSportsData } from "../../src/ui/data/sports-data-context";
import { useLeague } from "../../src/ui/data/use-league";
import { favoritesFor } from "../../src/ui/team/favorites";
import { useColors, DIVIDER } from "../../src/ui/theme/theme";
import { useDebounced } from "../../src/ui/common/use-debounced";
import { eventWeekStart, withSpecialEvents } from "../../src/ui/scores/special-events";
import { usePolled } from "../../src/ui/data/use-polled";
import { useDaySwipe } from "../../src/ui/scores/use-swipe";
import { useScoresToday } from "../../src/ui/scores/use-today";

/** How long the date must stay put before its scores are loaded. */
const DAY_SETTLE_MS = 250;

export default function ScoresScreen() {
  const sports = useSportsData();
  const league = useLeague();
  const colors = useColors();
  const { settings } = useSettings();
  const today = useScoresToday();
  // null means "follow today", so the list moves on to the new day instead of staying on yesterday.
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;
  const go = (d: string) => setPicked(d === today ? null : d);
  // Swiping or tapping through days quickly only loads the day you stop on, not every one passed.
  const settledDate = useDebounced(date, DAY_SETTLE_MS);
  const switching = settledDate !== date;
  const scores = usePolled(`${league}:scores:${settledDate}`, (o) => sports.getScores(league, settledDate, o));
  // Special event tags come from a separate week lookup (the scores do not carry them). Best effort: if it fails,
  // the cards just have no tag.
  const weekStart = eventWeekStart(settledDate);
  const events = usePolled(`${league}:events:${weekStart}`, (o) => sports.getSpecialEvents(league, weekStart, o));
  const swipe = useDaySwipe((step) => go(addDays(date, step)));
  // Favourite teams' games first, then live games on top and finished ones below, each group under its own
  // header; regrouped on each poll as games start and end.
  const sections = useMemo(
    () =>
      scores.data
        ? groupGamesForScores(withSpecialEvents(scores.data, events.data), favoritesFor(league, settings.favoriteTeams))
        : undefined,
    [scores.data, events.data, settings.favoriteTeams, league],
  );
  const games = useMemo(() => sections?.flatMap((s) => s.data), [sections]);

  return (
    <View style={styles.screen} {...swipe.panHandlers}>
      <View style={[styles.dateBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => go(addDays(date, -1))} hitSlop={12} accessibilityLabel="Previous day">
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
        </Pressable>
        <View style={styles.dateCenter}>
          <Pressable onPress={() => setPicked(null)} accessibilityLabel="Go to today">
            <Text style={[styles.dateText, { color: colors.text }]}>{dateLabel(date, today)}</Text>
          </Pressable>
          {/* Picking today goes through go(), so it stores no fixed date and keeps following today. */}
          <DatePickerButton date={date} onPick={go} onToday={() => setPicked(null)} />
        </View>
        <Pressable onPress={() => go(addDays(date, 1))} hitSlop={12} accessibilityLabel="Next day">
          <Ionicons name="chevron-forward" size={24} color={colors.accent} />
        </Pressable>
      </View>
      <UpdateBanner />
      <ShieldBanner games={games} />
      <OfflineBanner meta={scores.meta} />

      {scores.loading || switching ? (
        <ScoresSkeleton />
      ) : !scores.data && scores.error ? (
        <ErrorView title="Couldn't load scores" error={scores.error} onRetry={scores.refresh} />
      ) : (
        <SectionList
          sections={sections ?? []}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => <GameCard game={item} />}
          renderSectionHeader={({ section }) => (
            <Text
              style={[styles.sectionTitle, { color: section.key === "live" ? colors.live : colors.muted }]}
              accessibilityRole="header"
            >
              {section.title.toUpperCase()}
            </Text>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={scores.refreshing} onRefresh={scores.refresh} colors={[colors.accent]} />
          }
          ListEmptyComponent={<Empty message="No games on this date." />}
          ListFooterComponent={<UpdatedAt meta={scores.meta} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  dateBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: DIVIDER,
  },
  dateCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  dateText: { fontSize: 17, fontWeight: "600" },
  list: { paddingVertical: 3 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 2,
  },
});
