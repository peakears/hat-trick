import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LeagueId } from "../../domain";
import { useSportsData } from "../data/sports-data-context";
import { useLeague } from "../data/use-league";
import { leagueChipLabel, leagueChipSpoken, showLeagueRow, type DayCount } from "../leagues/league-row";
import { useSettings } from "../settings/settings-context";
import { scoreFontSemiBold } from "../theme/fonts";
import { DIVIDER, useColors } from "../theme/theme";

/**
 * The bar at the top of Scores, Standings and Leaders, under the status bar: a row of league chips, the picked one
 * filled. The pick is a setting, so all three tabs follow it and it survives a restart. With a single league the
 * bar keeps only the status bar's space.
 *
 * Scores passes `counts` (each league's games on the day it shows, which it loads anyway) and `all`, the "All" chip
 * that lists every league's games. Picking a league there turns "All" off.
 */
export function LeagueBar({
  counts,
  all,
}: {
  counts?: Partial<Record<LeagueId, DayCount>>;
  all?: { selected: boolean; onPress: () => void };
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const sports = useSportsData();
  const league = useLeague();
  const { update } = useSettings();
  const leagues = sports.leagues();
  const shown = showLeagueRow(leagues);
  const allCount = counts && sumCounts(leagues.map((id) => counts[id]));

  return (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top, backgroundColor: colors.card, borderBottomColor: colors.border },
        !shown && styles.empty,
      ]}
    >
      {shown && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          accessibilityRole="tablist"
          accessibilityLabel="League"
        >
          {all && (
            <Chip label="All" name="All leagues" selected={all.selected} onPress={all.onPress} count={allCount} />
          )}
          {leagues.map((id) => (
            <Chip
              key={id}
              label={leagueChipLabel(id)}
              name={sports.leagueName(id)}
              selected={!all?.selected && id === league}
              onPress={() => update(all ? { league: id, scoresAllLeagues: false } : { league: id })}
              count={counts?.[id]}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** The "All" chip's count: every league's, once each has loaded. */
function sumCounts(counts: (DayCount | undefined)[]): DayCount | undefined {
  if (counts.some((c) => c === undefined)) return undefined;
  return counts.reduce<DayCount>((sum, c) => ({ games: sum.games + c!.games, live: sum.live + c!.live }), {
    games: 0,
    live: 0,
  });
}

function Chip({
  label,
  name,
  selected,
  onPress,
  count,
}: {
  label: string;
  name: string;
  selected: boolean;
  onPress: () => void;
  count?: DayCount;
}) {
  const colors = useColors();
  const text = selected ? colors.chipSelectedText : colors.text;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: colors.chipSelected, borderColor: colors.chipSelected }
          : { backgroundColor: colors.surfaceSunken, borderColor: colors.cardBorder },
        { opacity: pressed ? 0.7 : 1 },
      ]}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={leagueChipSpoken(name, count)}
    >
      {count !== undefined && count.live > 0 && <View style={[styles.liveDot, { backgroundColor: colors.live }]} />}
      <Text style={[styles.label, { color: text }]}>{label}</Text>
      {count !== undefined && (
        <Text style={[styles.count, scoreFontSemiBold, { color: selected ? text : colors.muted }]}>{count.games}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: DIVIDER },
  empty: { borderBottomWidth: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: DIVIDER,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 14, fontWeight: "700" },
  count: { fontSize: 15 },
});
