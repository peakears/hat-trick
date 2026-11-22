import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Game } from "../../domain";
import { useSpoilers } from "../spoiler-context";
import { useColors, DIVIDER } from "../theme";

/** On Scores while the shield hides at least one game: says so, and shows every score at once. */
export function ShieldBanner({ games }: { games?: Game[] }) {
  const colors = useColors();
  const spoilers = useSpoilers();
  if (!games || !games.some((g) => spoilers.isHidden(g))) return null;
  return (
    <View style={[styles.banner, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.muted }]}>Spoiler shield is on.</Text>
      <Pressable
        onPress={spoilers.revealAll}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Show all scores"
      >
        <Text style={[styles.action, { color: colors.accent }]}>Show all scores</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: DIVIDER,
  },
  text: { fontSize: 13 },
  action: { fontSize: 13, fontWeight: "600" },
});
