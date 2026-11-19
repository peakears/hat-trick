import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Game, GameSide } from "../../domain";
import { gameStatusLabel, winner } from "../format";
import { tabular, useColors } from "../theme";
import { TeamLogo } from "./TeamLogo";

/** One game in the scores list: away team on top, home below, status on the right. */
export function GameCard({ game }: { game: Game }) {
  const colors = useColors();
  const won = winner(game);
  const live = game.status === "live";
  const showScores = game.status !== "scheduled" && game.status !== "postponed";

  const row = (side: GameSide, which: "home" | "away") => {
    const dim = won !== undefined && won !== which;
    return (
      <View style={styles.teamRow}>
        <TeamLogo team={side.team} size={28} />
        <Text
          numberOfLines={1}
          style={[styles.teamName, { color: dim ? colors.muted : colors.text }, !dim && won && styles.bold]}
        >
          {side.team.name}
        </Text>
        {showScores && (
          <Text style={[styles.score, tabular, { color: dim ? colors.muted : colors.text }]}>
            {side.score ?? "-"}
          </Text>
        )}
      </View>
    );
  };

  return (
    <Link href={{ pathname: "/game/[id]", params: { id: game.id } }} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${game.away.team.name} at ${game.home.team.name}, ${gameStatusLabel(game)}`}
      >
        <View style={styles.teams}>
          {row(game.away, "away")}
          {row(game.home, "home")}
        </View>
        <View style={[styles.status, { borderLeftColor: colors.border }]}>
          {live && <Text style={[styles.liveDot, { color: colors.live }]}>● LIVE</Text>}
          <Text style={[styles.statusText, tabular, { color: live ? colors.text : colors.muted }]}>
            {gameStatusLabel(game)}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 12,
    // A visible outline plus a wide gap keeps each game apart, even when the card is close to the
    // background (dark mode).
    borderWidth: 1,
    marginHorizontal: 12,
    marginVertical: 9,
    paddingVertical: 12,
    paddingLeft: 14,
  },
  teams: { flex: 1, gap: 8 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  teamName: { flex: 1, fontSize: 16 },
  bold: { fontWeight: "700" },
  score: { fontSize: 20, fontWeight: "700", minWidth: 28, textAlign: "right", marginRight: 12 },
  status: {
    width: 96,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  liveDot: { fontSize: 11, fontWeight: "700" },
  statusText: { fontSize: 13, fontWeight: "600", textAlign: "center" },
});
