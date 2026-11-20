import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "../theme";
import { useUpdate } from "../update-context";

/** A slim banner on Scores when a newer release exists. Tapping it opens the download; the X closes it. */
export function UpdateBanner() {
  const colors = useColors();
  const { status, dismiss } = useUpdate();
  if (status.kind !== "available" || status.dismissed) return null;
  const { release } = status;

  return (
    <View style={[styles.banner, { backgroundColor: colors.banner }]}>
      <Pressable
        style={styles.main}
        onPress={() => Linking.openURL(release.apkUrl ?? release.url).catch(() => {})}
        accessibilityRole="link"
        accessibilityLabel={`Version ${release.version} is available. Download`}
      >
        <Text style={[styles.text, { color: colors.bannerText }]}>
          Version {release.version} is available. <Text style={styles.link}>Download</Text>
        </Text>
      </Pressable>
      <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss update notice">
        <Ionicons name="close" size={20} color={colors.bannerText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, gap: 10 },
  main: { flex: 1 },
  text: { fontSize: 13 },
  link: { fontWeight: "700", textDecorationLine: "underline" },
});
