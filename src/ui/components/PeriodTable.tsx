import { StyleSheet, Text, View } from "react-native";
import type { Game } from "../../domain";
import { periodSpoken } from "../game/game-page";
import { scoreFont, scoreFontSemiBold } from "../theme/fonts";
import { DIVIDER, useColors } from "../theme/theme";

/**
 * Each period's score in a small table: periods across, away and home down, the total at the end. The labels come
 * from the adapter ("Q1", "2nd", "OT"), so it serves any league. Nothing without periods. The caller hides it behind
 * the spoiler shield.
 */
export function PeriodTable({ game }: { game: Game }) {
  const colors = useColors();
  const periods = game.periods;
  if (!periods || periods.length === 0) return null;
  const final = game.status === "final";
  const lost = (side: "away" | "home") =>
    final &&
    (game.away.score ?? 0) !== (game.home.score ?? 0) &&
    (side === "away"
      ? (game.away.score ?? 0) < (game.home.score ?? 0)
      : (game.home.score ?? 0) < (game.away.score ?? 0));
  const row = (side: "away" | "home") => {
    const color = lost(side) ? colors.muted : colors.text;
    return (
      <View style={[styles.row, { borderTopColor: colors.border }]}>
        <Text style={[styles.team, { color }]}>{game[side].team.abbrev}</Text>
        {periods.map((p, i) => (
          <Text key={`${p.label}-${i}`} style={[styles.cell, scoreFontSemiBold, { color }]}>
            {p[side]}
          </Text>
        ))}
        <Text style={[styles.cell, styles.total, scoreFont, { color }]}>{game[side].score ?? "-"}</Text>
      </View>
    );
  };
  return (
    <View
      style={[styles.card, { backgroundColor: colors.card }]}
      accessible
      accessibilityLabel={`Score by period. ${periods.map((p) => periodSpoken(p.label, p.away, p.home, game)).join(". ")}`}
    >
      <View style={styles.row}>
        <Text style={[styles.team, styles.head, { color: colors.muted }]}> </Text>
        {periods.map((p, i) => (
          <Text key={`${p.label}-${i}`} style={[styles.cell, styles.head, { color: colors.muted }]}>
            {p.label}
          </Text>
        ))}
        <Text style={[styles.cell, styles.total, styles.head, { color: colors.muted }]}>T</Text>
      </View>
      {row("away")}
      {row("home")}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, marginHorizontal: 12, marginTop: 8, paddingVertical: 6, paddingHorizontal: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderTopWidth: DIVIDER,
    borderTopColor: "transparent",
  },
  team: { width: 48, fontSize: 13, fontWeight: "700" },
  head: { fontSize: 12, fontWeight: "600" },
  cell: { flex: 1, textAlign: "center", fontSize: 16 },
  total: { flex: 1.2, fontSize: 18 },
});
