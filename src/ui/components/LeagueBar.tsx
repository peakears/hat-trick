import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LeagueId } from "../../domain";
import { useSportsData } from "../data/sports-data-context";
import { useLeague } from "../data/use-league";
import { usePolled } from "../data/use-polled";
import { dayCount, leagueChipLabel, leagueChipSpoken, showLeagueRow, type DayCount } from "../leagues/league-row";
import { useSettings } from "../settings/settings-context";
import { scoreFontSemiBold } from "../theme/fonts";
import { DIVIDER, useColors } from "../theme/theme";

/**
 * The bar at the top of Scores, Standings and Leaders, under the status bar: a row of league chips, the picked one
 * filled. The pick is a setting, so all three tabs follow it and it survives a restart. With a single league the
 * bar keeps only the status bar's space.
 *
 * On Scores, pass `date`: each chip then shows that day's game count and a dot when a game is live. A chip reads
 * the same cache entry as the Scores list (`{league}:scores:{date}`), so the picked league costs no extra request,
 * and switching to another league shows its games at once.
 */
export function LeagueBar({ date }: { date?: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const sports = useSportsData();
  const league = useLeague();
  const { update } = useSettings();
  const leagues = sports.leagues();

  return (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top, backgroundColor: colors.card, borderBottomColor: colors.border },
        !showLeagueRow(leagues) && styles.empty,
      ]}
    >
      {showLeagueRow(leagues) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          accessibilityRole="tablist"
          accessibilityLabel="League"
        >
          {leagues.map((id) => {
            const chip = {
              league: id,
              name: sports.leagueName(id),
              selected: id === league,
              onPress: () => update({ league: id }),
            };
            return date ? <DayChip key={id} {...chip} date={date} /> : <Chip key={id} {...chip} />;
          })}
        </ScrollView>
      )}
    </View>
  );
}

interface ChipProps {
  league: LeagueId;
  name: string;
  selected: boolean;
  onPress: () => void;
}

/** A chip with the day's games: loads them as the Scores list does, under the same key. */
function DayChip({ date, ...chip }: ChipProps & { date: string }) {
  const sports = useSportsData();
  const day = usePolled(`${chip.league}:scores:${date}`, (o) => sports.getScores(chip.league, date, o));
  return <Chip {...chip} count={dayCount(day.data)} />;
}

function Chip({ league, name, selected, onPress, count }: ChipProps & { count?: DayCount }) {
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
      <Text style={[styles.label, { color: text }]}>{leagueChipLabel(league)}</Text>
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
