import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Game, GameSide } from "../../domain";
import { isFavorite } from "../favorites";
import { gameStatusLabel, winner } from "../format";
import { useSettings } from "../settings-context";
import { tabular, useColors } from "../theme";
import { TeamLogo } from "./TeamLogo";

/** One game in the scores list: away team on top, home below, status on the right. */
export function GameCard({ game }: { game: Game }) {
  const colors = useColors();
  const router = useRouter();
  const { settings } = useSettings();
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
        {isFavorite(settings.favoriteTeams, side.team.id) && (
          <Ionicons name="star" size={14} color={colors.accent} accessibilityLabel="Favourite team" />
        )}
        {showScores && (
          <Text style={[styles.score, tabular, { color: dim ? colors.muted : colors.text }]}>
            {side.score ?? "-"}
          </Text>
        )}
      </View>
    );
  };

  return (
    // Not <Link asChild>: its Slot merges styles by spreading them, which drops a style function
    // like the one below (pressed state), so the card would lose all of its styling.
    <Pressable
      onPress={() => router.push({ pathname: "/game/[id]", params: { id: game.id } })}
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
