import { StyleSheet, Text, View } from "react-native";
import type { Game } from "../../domain";
import { periodSpoken } from "../game/game-page";
import { scoreFont, scoreFontSemiBold } from "../theme/fonts";
import { DIVIDER, useColors } from "../theme/theme";

/**
 * Each period's score in a small table: periods across, away and home down, the total at the end. The labels come
 * from the adapter ("Q1", "2nd", "OT"), so it serves any league; a live game lists every regulation period, "-" for
 * those not played yet. Nothing without periods. The caller hides it behind
 * the spoiler shield. `compact` is the Scores card's version: smaller, on a sunken background inside the card, and
 * silent for screen readers (the card's own label says the score).
 */
export function PeriodTable({ game, compact = false }: { game: Game; compact?: boolean }) {
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
      <View style={[styles.row, compact && styles.rowCompact, { borderTopColor: colors.border }]}>
        <Text style={[styles.team, compact && styles.teamCompact, { color }]}>{game[side].team.abbrev}</Text>
        {periods.map((p, i) => (
          // A period not played yet shows "-".
          <Text
            key={`${p.label}-${i}`}
            style={[
              styles.cell,
              compact && styles.cellCompact,
              scoreFontSemiBold,
              { color: p[side] === null ? colors.muted : color },
            ]}
          >
            {p[side] ?? "-"}
          </Text>
        ))}
        <Text style={[styles.cell, styles.total, compact && styles.totalCompact, scoreFont, { color }]}>
          {game[side].score ?? "-"}
        </Text>
      </View>
    );
  };
  return (
    <View
      style={
        compact
          ? [styles.cardCompact, { backgroundColor: colors.surfaceSunken }]
          : [styles.card, { backgroundColor: colors.card }]
      }
      accessible={!compact}
      accessibilityLabel={
        compact
          ? undefined
          : `Score by period. ${periods.map((p) => periodSpoken(p.label, p.away, p.home, game)).join(". ")}`
      }
    >
      <View style={[styles.row, compact && styles.rowCompact]}>
        <Text style={[styles.team, compact && styles.teamCompact, styles.head, { color: colors.muted }]}> </Text>
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
  cardCompact: { borderRadius: 10, paddingVertical: 2, paddingHorizontal: 10 },
  rowCompact: { paddingVertical: 4 },
  team: { width: 48, fontSize: 13, fontWeight: "700" },
  teamCompact: { width: 44, fontSize: 12 },
  head: { fontSize: 12, fontWeight: "600" },
  cell: { flex: 1, textAlign: "center", fontSize: 16 },
  cellCompact: { fontSize: 14 },
  total: { flex: 1.2, fontSize: 18 },
  totalCompact: { fontSize: 15 },
});
