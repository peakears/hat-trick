import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DataMeta } from "../../data";
import { timeLabel } from "../common/format";
import { useColors } from "../theme/theme";

export function ErrorView({ title, error, onRetry }: { title: string; error: Error; onRetry: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.muted }]}>{error.message}</Text>
      <Pressable onPress={onRetry} style={[styles.button, { borderColor: colors.accent }]} accessibilityRole="button">
        <Text style={{ color: colors.accent, fontWeight: "600" }}>Try again</Text>
      </Pressable>
    </View>
  );
}

/**
 * Shown by a route's ErrorBoundary when a screen throws while rendering. Without one, a release
 * build shows a blank screen. It may render outside the theme provider, so it sets its own background.
 */
export function CrashScreen({ error, retry }: { error: Error; retry: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ErrorView title="Something went wrong" error={error} onRetry={retry} />
    </View>
  );
}

export function Empty({ message }: { message: string }) {
  const colors = useColors();
  return (
    <View style={styles.center}>
      <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>
    </View>
  );
}

/** A banner when the screen shows last known data because a refresh failed (usually offline). */
export function OfflineBanner({ meta }: { meta?: DataMeta }) {
  const colors = useColors();
  if (!meta?.error) return null;
  return (
    <View style={[styles.banner, { backgroundColor: colors.banner }]}>
      <Text style={{ color: colors.bannerText, fontSize: 13 }}>
        Can't reach the server. Showing data from {timeLabel(meta.fetchedAt)}.
      </Text>
    </View>
  );
}

/** "Updated 10:42 PM", shown under a list. */
export function UpdatedAt({ meta }: { meta?: DataMeta }) {
  const colors = useColors();
  if (!meta) return null;
  return <Text style={[styles.updated, { color: colors.muted }]}>Updated {timeLabel(meta.fetchedAt)}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8, minHeight: 240 },
  title: { fontSize: 17, fontWeight: "600" },
  message: { fontSize: 14, textAlign: "center" },
  button: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  banner: { paddingHorizontal: 16, paddingVertical: 8 },
  updated: { textAlign: "center", fontSize: 12, paddingVertical: 16 },
});
