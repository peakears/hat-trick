import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { installStatusText, isBusy } from "../install-update";
import { RELEASES_URL } from "../links";
import { parseReleaseNotes } from "../release-notes";
import { useColors } from "../theme";
import { useUpdate } from "../update-context";
import { isReleasePageUrl } from "../updates";

/**
 * "What's new" for the release on offer: its notes as plain sections, an Update button and a link to
 * every release's notes (the sheet only has the newest release's, so a skipped version is there).
 * Shows nothing unless an update is available.
 */
export function ReleaseNotesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { status, install, installNow, cancelInstall, openInBrowser, canInstallInApp } = useUpdate();
  const release = status.kind === "available" ? status.release : undefined;
  const sections = useMemo(() => parseReleaseNotes(release?.notes), [release?.notes]);
  if (!release) return null;

  const busy = isBusy(install);
  const downloading = install.kind === "downloading";
  const failed = install.kind === "failed";
  const statusText = installStatusText(install);
  const notesUrl = isReleasePageUrl(release.url) ? release.url : RELEASES_URL;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            What's new in {release.version}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {sections.length === 0 ? (
            <Text style={[styles.item, { color: colors.muted }]}>No notes for this release.</Text>
          ) : (
            sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.muted }]}>{section.title.toUpperCase()}</Text>
                {section.items.map((item, i) => (
                  <View key={i} style={styles.itemRow}>
                    <Text style={[styles.item, { color: colors.text }]}>{"•"}</Text>
                    <Text style={[styles.item, styles.itemText, { color: colors.text }]}>{item}</Text>
                  </View>
                ))}
              </View>
            ))
          )}
          <Pressable onPress={() => Linking.openURL(notesUrl).catch(() => {})} accessibilityRole="link" hitSlop={8}>
            <Text style={[styles.link, { color: colors.accent }]}>Full release notes on GitHub</Text>
          </Pressable>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {statusText ? <Text style={[styles.status, { color: colors.muted }]}>{statusText}</Text> : null}
          {downloading ? (
            <Pressable
              onPress={cancelInstall}
              accessibilityRole="button"
              accessibilityLabel="Cancel the download"
              style={[styles.button, styles.cancel, { borderColor: colors.border }]}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={failed ? openInBrowser : installNow}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.button, { backgroundColor: busy ? colors.border : colors.accent }]}
            >
              <Text style={[styles.buttonText, { color: busy ? colors.muted : colors.onAccent }]}>
                {failed ? "Open in browser" : canInstallInApp ? `Update to ${release.version}` : "Download"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: "700" },
  body: { padding: 16, gap: 20 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  itemRow: { flexDirection: "row", gap: 8 },
  item: { fontSize: 15, lineHeight: 21 },
  itemText: { flex: 1 },
  link: { fontSize: 15, fontWeight: "600" },
  footer: { padding: 16, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  status: { fontSize: 13, textAlign: "center" },
  button: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  cancel: { borderWidth: StyleSheet.hairlineWidth },
  buttonText: { fontSize: 16, fontWeight: "700" },
});
