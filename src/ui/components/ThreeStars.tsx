import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import type { GameStar } from "../../domain";
import { starAccessibilityLabel, starPlayerLine, starStatLine } from "../stars";
import { tabular, useColors } from "../theme";
import { PlayerHeadshot } from "./PlayerHeadshot";

/** The game's three stars: photo, name, team and a short stat line for each, first star first. */
export function ThreeStars({ stars }: { stars: GameStar[] }) {
  const colors = useColors();
  if (stars.length === 0) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.muted }]} accessibilityRole="header">
        Three stars
      </Text>
      {stars.map((star, i) => {
        const playerLine = starPlayerLine(star);
        const statLine = starStatLine(star);
        return (
          <View
            key={`${star.rank}-${star.player.id}`}
            style={[styles.row, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
            accessible
            accessibilityLabel={starAccessibilityLabel(star)}
          >
            <View style={styles.rank}>
              <Ionicons name="star" size={14} color={colors.accent} />
              <Text style={[styles.rankNumber, tabular, { color: colors.text }]}>{star.rank}</Text>
            </View>
            <PlayerHeadshot player={star.player} />
            <View style={styles.main}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {star.player.name}
              </Text>
              {playerLine ? (
                <Text style={[styles.detail, { color: colors.muted }]} numberOfLines={1}>
                  {playerLine}
                </Text>
              ) : null}
            </View>
            {statLine ? (
              <Text style={[styles.stats, tabular, { color: colors.text }]} numberOfLines={2}>
                {statLine}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  title: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", paddingVertical: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  rank: { width: 22, alignItems: "center" },
  rankNumber: { fontSize: 12, fontWeight: "700", marginTop: 1 },
  main: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600" },
  detail: { fontSize: 12, marginTop: 2 },
  stats: { fontSize: 13, fontWeight: "600", textAlign: "right", maxWidth: "45%" },
});
