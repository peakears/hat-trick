import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { GameCard } from "../../src/ui/components/GameCard";
import { Empty, ErrorView, Loading, OfflineBanner, UpdatedAt } from "../../src/ui/components/States";
import { addDays, dateLabel, localDate } from "../../src/ui/format";
import { LEAGUE, useSportsData } from "../../src/ui/sports-data-context";
import { useColors } from "../../src/ui/theme";
import { usePolled } from "../../src/ui/use-polled";

export default function ScoresScreen() {
  const sports = useSportsData();
  const colors = useColors();
  const today = localDate();
  const [date, setDate] = useState(today);
  const scores = usePolled(`scores:${date}`, (o) => sports.getScores(LEAGUE, date, o));

  return (
    <View style={styles.screen}>
      <View style={[styles.dateBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => setDate(addDays(date, -1))} hitSlop={12} accessibilityLabel="Previous day">
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
        </Pressable>
        <Pressable onPress={() => setDate(today)} accessibilityLabel="Go to today">
          <Text style={[styles.dateText, { color: colors.text }]}>{dateLabel(date, today)}</Text>
        </Pressable>
        <Pressable onPress={() => setDate(addDays(date, 1))} hitSlop={12} accessibilityLabel="Next day">
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
          data={scores.data}
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
  dateText: { fontSize: 17, fontWeight: "600" },
  list: { paddingVertical: 3 },
});
