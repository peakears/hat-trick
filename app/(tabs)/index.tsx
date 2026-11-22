import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { DatePickerButton } from "../../src/ui/components/DatePickerButton";
import { PullToRefresh } from "../../src/ui/components/PullToRefresh";
import { GameCard } from "../../src/ui/components/GameCard";
import { Empty, ErrorView, Loading, OfflineBanner, UpdatedAt } from "../../src/ui/components/States";
import { ShieldBanner } from "../../src/ui/components/ShieldBanner";
import { UpdateBanner } from "../../src/ui/components/UpdateBanner";
import { addDays, dateLabel, groupGamesForScores } from "../../src/ui/format";
import { useSettings } from "../../src/ui/settings-context";
import { LEAGUE, useSportsData } from "../../src/ui/sports-data-context";
import { useColors } from "../../src/ui/theme";
import { useDebounced } from "../../src/ui/use-debounced";
import { eventWeekStart, withSpecialEvents } from "../../src/ui/special-events";
import { usePolled } from "../../src/ui/use-polled";
import { useDaySwipe } from "../../src/ui/use-swipe";
import { useScoresToday } from "../../src/ui/use-today";

/** How long the date must stay put before its scores are loaded. */
const DAY_SETTLE_MS = 250;

export default function ScoresScreen() {
  const sports = useSportsData();
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
  const scores = usePolled(`scores:${settledDate}`, (o) => sports.getScores(LEAGUE, settledDate, o));
  // Special event tags come from a separate week lookup (the scores do not carry them). Best effort: if it fails,
  // the cards just have no tag.
  const weekStart = eventWeekStart(settledDate);
  const events = usePolled(`events:${weekStart}`, (o) => sports.getSpecialEvents(LEAGUE, weekStart, o));
  const swipe = useDaySwipe((step) => go(addDays(date, step)));
  // Favourite teams' games first, then live games on top and finished ones below, each group under its own
  // header; regrouped on each poll as games start and end.
  const sections = useMemo(
    () =>
      scores.data
        ? groupGamesForScores(withSpecialEvents(scores.data, events.data), settings.favoriteTeams)
        : undefined,
    [scores.data, events.data, settings.favoriteTeams],
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
        <Loading />
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
          refreshControl={<PullToRefresh refreshing={scores.refreshing} onRefresh={scores.refresh} />}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
