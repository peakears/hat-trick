import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { DatePickerButton } from "../../src/ui/components/DatePickerButton";
import { GameCard } from "../../src/ui/components/GameCard";
import { Empty, ErrorView, Loading, OfflineBanner, UpdatedAt } from "../../src/ui/components/States";
import { addDays, dateLabel, sortGamesForScores } from "../../src/ui/format";
import { useSettings } from "../../src/ui/settings-context";
import { LEAGUE, useSportsData } from "../../src/ui/sports-data-context";
import { useColors } from "../../src/ui/theme";
import { usePolled } from "../../src/ui/use-polled";
import { useScoresToday } from "../../src/ui/use-today";

export default function ScoresScreen() {
  const sports = useSportsData();
  const colors = useColors();
  const { settings } = useSettings();
  const today = useScoresToday();
  // null means "follow today", so the list moves on to the new day instead of staying on yesterday.
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;
  const go = (d: string) => setPicked(d === today ? null : d);
  const scores = usePolled(`scores:${date}`, (o) => sports.getScores(LEAGUE, date, o));
  // Favourite teams' games first, then live games on top and finished ones below; re-sorted on each
  // poll as games start and end.
  const games = useMemo(
    () => (scores.data ? sortGamesForScores(scores.data, settings.favoriteTeams) : undefined),
    [scores.data, settings.favoriteTeams],
  );

  return (
    <View style={styles.screen}>
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
      <OfflineBanner meta={scores.meta} />

      {scores.loading ? (
        <Loading />
      ) : !scores.data && scores.error ? (
        <ErrorView title="Couldn't load scores" error={scores.error} onRetry={scores.refresh} />
      ) : (
        <FlatList
          data={games}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => <GameCard game={item} />}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dateCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  dateText: { fontSize: 17, fontWeight: "600" },
  list: { paddingVertical: 3 },
});
