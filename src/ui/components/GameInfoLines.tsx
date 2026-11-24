import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import type { Game } from "../../domain";
import { channelsFor, channelsLabel, watchHeading } from "../game/broadcasts";
import { venueLabel } from "../common/format";
import { useColors, DIVIDER } from "../theme/theme";
import { useTvRegion } from "../game/use-tv-region";

/**
 * The bottom of the game page's score card: where the game is played and every TV channel for the viewer's country,
 * one compact line each behind a small icon. National channels are bold; a team's own feed shows the team in
 * brackets. Renders nothing when neither is known.
 */
export function GameInfoLines({ game }: { game: Game }) {
  const colors = useColors();
  const region = useTvRegion();
  const venue = venueLabel(game.venue);
  const channels = channelsFor(game, region);
  if (!venue && channels.length === 0) return null;

  return (
    <View style={[styles.box, { borderTopColor: colors.border }]}>
      {venue && (
        <View style={styles.line} accessible accessibilityLabel={`Played at ${venue}`}>
          <Ionicons name="location-outline" size={14} color={colors.muted} style={styles.icon} />
          <Text style={[styles.text, { color: colors.muted }]} numberOfLines={1}>
            {venue}
          </Text>
        </View>
      )}
      {channels.length > 0 && (
        <View
          style={styles.line}
          accessible
          accessibilityLabel={`${watchHeading(game.status)}: ${channelsLabel(channels)}`}
        >
          <Ionicons name="tv-outline" size={14} color={colors.muted} style={styles.icon} />
          {/* Two lines at most: a game with several team feeds can list five or six channels. */}
          <Text style={[styles.text, { color: colors.muted }]} numberOfLines={2}>
            {channels.map((c, i) => (
              <Text key={c.network}>
                {i > 0 ? " · " : ""}
                <Text style={c.market === "national" ? { color: colors.text, fontWeight: "700" } : undefined}>
                  {c.network}
                </Text>
                {c.teamAbbrev ? ` (${c.teamAbbrev})` : ""}
              </Text>
            ))}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderTopWidth: DIVIDER, marginTop: 12, paddingTop: 10, gap: 6 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  icon: { marginTop: 1 },
  text: { flex: 1, fontSize: 13 },
});
