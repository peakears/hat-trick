import { StyleSheet, Text, View } from "react-native";
import type { Game } from "../../domain";
import { channelsFor, channelsLabel } from "../broadcasts";
import { useTvRegion } from "../use-tv-region";
import { useColors } from "../theme";

/** The full TV list on the game page: national channels, then each team's own feed. Nothing when none are known. */
export function WhereToWatch({ game }: { game: Game }) {
  const colors = useColors();
  const region = useTvRegion();
  const channels = channelsFor(game, region);
  if (channels.length === 0) return null;

  const national = channels.filter((c) => c.market === "national");
  const teamFeeds = channels.filter((c) => c.market !== "national");

  return (
    <View
      style={[styles.box, { backgroundColor: colors.card }]}
      accessible
      accessibilityLabel={`Where to watch: ${channelsLabel(channels)}`}
    >
      <Text style={[styles.title, { color: colors.muted }]} importantForAccessibility="no">
        WHERE TO WATCH
      </Text>
      {national.length > 0 && (
        <Text style={[styles.names, { color: colors.text }]} importantForAccessibility="no">
          {national.map((c) => c.network).join(" · ")}
        </Text>
      )}
      {teamFeeds.length > 0 && (
        <Text style={[styles.feeds, { color: colors.muted }]} importantForAccessibility="no">
          {teamFeeds.map((c) => `${c.network} (${c.teamAbbrev})`).join(" · ")}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginHorizontal: 12, marginTop: 8, padding: 14, borderRadius: 12, gap: 4 },
  title: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  names: { fontSize: 15, fontWeight: "700" },
  feeds: { fontSize: 13 },
});
