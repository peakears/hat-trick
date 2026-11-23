import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSportsData } from "../data/sports-data-context";
import { useLeague } from "../data/use-league";
import { useSettings } from "../settings/settings-context";
import { useColors } from "../theme/theme";

/**
 * The league picker in the header of the Scores, Standings and Leaders tabs: one small segment per league the app
 * has. The pick is a setting, so all three tabs follow it and it survives a restart. Hidden with a single league.
 */
export function LeagueSwitcher() {
  const colors = useColors();
  const sports = useSportsData();
  const league = useLeague();
  const { update } = useSettings();
  const leagues = sports.leagues();
  if (leagues.length < 2) return null;
  return (
    <View
      style={[styles.container, { backgroundColor: colors.border }]}
      accessibilityRole="tablist"
      accessibilityLabel="League"
    >
      {leagues.map((id) => {
        const selected = id === league;
        return (
          <Pressable
            key={id}
            onPress={() => update({ league: id })}
            hitSlop={4}
            style={[styles.option, selected && { backgroundColor: colors.card }]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, { color: selected ? colors.text : colors.muted }]}>{id.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", borderRadius: 8, padding: 2, marginRight: 12 },
  option: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  label: { fontSize: 13, fontWeight: "700" },
});
