import { StyleSheet, Text, View } from "react-native";
import { channelsLabel, summarizeChannels, type Channel } from "../game/broadcasts";
import { useColors, DIVIDER } from "../theme/theme";

/**
 * The first few of a game's TV channels (already limited to the user's region), one line under a Scores card.
 * National channels are bold; a home or away feed shows its team in brackets. Renders nothing for an empty list.
 */
export function ChannelLine({ channels }: { channels: Channel[] }) {
  const colors = useColors();
  if (channels.length === 0) return null;
  const { shown, more } = summarizeChannels(channels);

  return (
    <View
      style={[styles.line, { borderTopColor: colors.border }]}
      accessible
      accessibilityLabel={`On TV: ${channelsLabel(channels)}`}
    >
      <Text style={[styles.icon, { color: colors.muted }]} importantForAccessibility="no">
        TV
      </Text>
      <Text numberOfLines={1} style={[styles.text, { color: colors.muted }]} importantForAccessibility="no">
        {shown.map((c, i) => (
          <Text key={c.network}>
            {i > 0 ? " · " : ""}
            <Text style={c.market === "national" ? { color: colors.text, fontWeight: "700" } : undefined}>
              {c.network}
            </Text>
            {c.teamAbbrev ? ` (${c.teamAbbrev})` : ""}
          </Text>
        ))}
        {more > 0 ? ` +${more}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: DIVIDER,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  icon: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  text: { flex: 1, fontSize: 12 },
});
