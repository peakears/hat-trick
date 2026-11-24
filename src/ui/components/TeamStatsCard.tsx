import { StyleSheet, Text, View } from "react-native";
import type { Game, TeamStatLine } from "../../domain";
import { awayShare, teamStatSpoken } from "../game/game-page";
import { scoreFontSemiBold } from "../theme/fonts";
import { DIVIDER, useColors } from "../theme/theme";

/**
 * The teams side by side: one line per stat, away on the left and home on the right, with a bar split by each
 * team's share when the stat compares as numbers. The adapter picks and words the stats. The caller hides it
 * behind the spoiler shield.
 */
export function TeamStatsCard({ game, stats }: { game: Game; stats: TeamStatLine[] }) {
  const colors = useColors();
  if (stats.length === 0) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.headRow}>
        <Text style={[styles.title, { color: colors.muted }]} accessibilityRole="header">
          Team stats
        </Text>
        <Text style={[styles.teams, { color: colors.muted }]} importantForAccessibility="no">
          {game.away.team.abbrev} · {game.home.team.abbrev}
        </Text>
      </View>
      {stats.map((line, i) => {
        const share = awayShare(line);
        return (
          <View
            key={line.label}
            style={[styles.line, i > 0 && { borderTopColor: colors.border, borderTopWidth: DIVIDER }]}
            accessible
            accessibilityLabel={teamStatSpoken(line, game)}
          >
            <View style={styles.values}>
              <Text style={[styles.value, scoreFontSemiBold, { color: colors.text }]}>{line.away}</Text>
              <Text style={[styles.label, { color: colors.muted }]} numberOfLines={1}>
                {line.label}
              </Text>
              <Text style={[styles.value, styles.right, scoreFontSemiBold, { color: colors.text }]}>{line.home}</Text>
            </View>
            {share !== undefined && (
              <View style={styles.bar}>
                <View style={[styles.segment, { flex: share, backgroundColor: colors.accent }]} />
                <View style={[styles.segment, { flex: 1 - share, backgroundColor: colors.cardBorder }]} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, marginHorizontal: 12, marginTop: 8, paddingVertical: 6, paddingHorizontal: 12 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  title: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  teams: { fontSize: 12, fontWeight: "600" },
  line: { paddingVertical: 8, gap: 6 },
  values: { flexDirection: "row", alignItems: "center", gap: 8 },
  value: { width: 56, fontSize: 16 },
  right: { textAlign: "right" },
  label: { flex: 1, textAlign: "center", fontSize: 13 },
  bar: { flexDirection: "row", height: 4, gap: 3 },
  segment: { borderRadius: 2 },
});
