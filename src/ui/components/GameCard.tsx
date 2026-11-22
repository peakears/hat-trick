import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Game, GameSide } from "../../domain";
import { isFavorite } from "../favorites";
import { winner } from "../format";
import { channelsFor, channelsLabel, showsChannelsOnCard } from "../broadcasts";
import { useSettings } from "../settings-context";
import { useSpoilers } from "../spoiler-context";
import { tabular, useColors } from "../theme";
import { useTvRegion } from "../use-tv-region";
import { ChannelLine } from "./ChannelLine";
import { RevealButton } from "./ShieldUi";
import { SpecialEventTag } from "./SpecialEventTag";
import { TeamLogo } from "./TeamLogo";

/** One game in the scores list: away team on top, home below, status on the right. */
export function GameCard({ game }: { game: Game }) {
  const colors = useColors();
  const router = useRouter();
  const { settings } = useSettings();
  const spoilers = useSpoilers();
  const hidden = spoilers.isHidden(game);
  const statusLabel = spoilers.statusLabel(game);
  // A hidden game must not give the winner away through bold or dimmed names either.
  const won = hidden ? undefined : winner(game);
  const live = game.status === "live";
  // The colour alone says "favourite", so say it in words for screen readers too.
  const favoriteNames = [game.away, game.home]
    .filter((side) => isFavorite(settings.favoriteTeams, side.team.id))
    .map((side) => side.team.name);
  const favoriteNote = favoriteNames.length > 0 ? `. Favourite: ${favoriteNames.join(", ")}` : "";
  const region = useTvRegion();
  const channels = showsChannelsOnCard(game.status) ? channelsFor(game, region) : [];
  const showScores = game.status !== "scheduled" && game.status !== "postponed";

  const row = (side: GameSide, which: "home" | "away") => {
    const dim = won !== undefined && won !== which;
    const favorite = isFavorite(settings.favoriteTeams, side.team.id);
    return (
      <View style={styles.teamRow}>
        <TeamLogo team={side.team} size={28} />
        <Text
          numberOfLines={1}
          // A favourite team's name is drawn in the accent colour, even when it lost and the rest is dimmed.
          style={[
            styles.teamName,
            { color: favorite ? colors.accent : dim ? colors.muted : colors.text },
            (favorite || (!dim && won)) && styles.bold,
          ]}
        >
          {side.team.name}
        </Text>
        {!showScores && side.record && (
          // Before puck drop there is no score, so the season record takes that spot.
          <Text style={[styles.record, tabular, { color: colors.muted }]} accessibilityLabel={`Record ${side.record}`}>
            {side.record}
          </Text>
        )}
        {showScores && (
          <Text style={[styles.score, tabular, { color: dim || hidden ? colors.muted : colors.text }]}>
            {hidden ? "•" : (side.score ?? "-")}
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
      accessibilityLabel={`${game.specialEvent ? `${game.specialEvent}. ` : ""}${game.away.team.name} at ${game.home.team.name}, ${statusLabel}${hidden ? ". Score hidden" : ""}${favoriteNote}${channels.length > 0 ? `. On TV: ${channelsLabel(channels)}` : ""}`}
    >
      <View style={styles.main}>
        <View style={styles.teams}>
          <SpecialEventTag name={game.specialEvent} />
          {row(game.away, "away")}
          {row(game.home, "home")}
        </View>
        <View style={[styles.status, { borderLeftColor: colors.border }]}>
          {live && <Text style={[styles.liveDot, { color: colors.live }]}>● LIVE</Text>}
          <Text style={[styles.statusText, tabular, { color: live ? colors.text : colors.muted }]}>{statusLabel}</Text>
          {hidden && <RevealButton label="Show score" onPress={() => spoilers.reveal(game.id)} />}
        </View>
      </View>
      <ChannelLine channels={channels} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: "hidden",
    // A visible outline plus a wide gap keeps each game apart, even when the card is close to the
    // background (dark mode).
    borderWidth: 1,
    marginHorizontal: 12,
    marginVertical: 9,
  },
  main: { flexDirection: "row", paddingVertical: 12, paddingLeft: 14 },
  teams: { flex: 1, gap: 8 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  teamName: { flex: 1, fontSize: 16 },
  bold: { fontWeight: "700" },
  record: { fontSize: 13, fontWeight: "600", marginRight: 12 },
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
