import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GameVideo } from "../../domain";
import { useColors, DIVIDER } from "../theme";
import { playableVideos, VIDEO_LABELS } from "../videos";
import { openVideo } from "../videos-native";

/**
 * A finished game's recap and condensed game, opened on the league's website in a browser tab. The rows name no
 * players or score, so they are safe under the spoiler shield; the video page itself is the user's choice to open.
 */
export function GameVideos({ videos }: { videos: GameVideo[] | undefined }) {
  const colors = useColors();
  const shown = playableVideos(videos);
  if (shown.length === 0) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.muted }]}>Videos</Text>
      {shown.map((video, i) => {
        const { title, detail } = VIDEO_LABELS[video.kind];
        return (
          <Pressable
            key={video.kind}
            onPress={() => openVideo(video.url, colors.card)}
            accessibilityRole="link"
            accessibilityLabel={`Watch the ${title.toLowerCase()}`}
            accessibilityHint="Opens in a browser tab"
            style={[styles.row, i > 0 && { borderTopWidth: DIVIDER, borderTopColor: colors.border }]}
          >
            <Ionicons name="play-circle" size={28} color={colors.accent} />
            <View style={styles.text}>
              <Text style={[styles.label, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.detail, { color: colors.muted }]}>{detail}</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.muted} />
          </Pressable>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  title: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", paddingVertical: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  text: { flex: 1, gap: 1 },
  label: { fontSize: 15, fontWeight: "600" },
  detail: { fontSize: 12 },
});
