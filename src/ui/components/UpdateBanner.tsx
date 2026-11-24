import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { installStatusText, isBusy } from "../updates/install-update";
import { useColors } from "../theme/theme";
import { useUpdate } from "../updates/update-context";
import { ReleaseNotesModal } from "./ReleaseNotesModal";

/**
 * A slim banner on Scores when a newer release exists. Tapping it opens "What's new", which has the
 * Update button; after a failed install it opens the download in the browser instead. The X closes it,
 * and while downloading a Cancel link stops the download.
 */
export function UpdateBanner() {
  const colors = useColors();
  const { status, dismiss, install, openInBrowser, cancelInstall } = useUpdate();
  const [notesOpen, setNotesOpen] = useState(false);
  if (status.kind !== "available" || status.dismissed) return null;
  const { release } = status;
  const busy = isBusy(install);
  const failed = install.kind === "failed";

  return (
    <View style={[styles.banner, { backgroundColor: colors.banner }]}>
      <Pressable
        style={styles.main}
        onPress={failed ? openInBrowser : () => setNotesOpen(true)}
        disabled={busy}
        accessibilityRole={failed ? "link" : "button"}
        accessibilityLabel={
          busy
            ? (installStatusText(install) ?? "Updating")
            : failed
              ? `${installStatusText(install)} Open the download in the browser`
              : `Version ${release.version} is available. See what's new`
        }
      >
        {busy ? (
          <Text style={[styles.text, { color: colors.bannerText }]}>{installStatusText(install)}</Text>
        ) : failed ? (
          <Text style={[styles.text, { color: colors.bannerText }]}>
            {installStatusText(install)} <Text style={styles.link}>Open in browser</Text>
          </Text>
        ) : (
          <Text style={[styles.text, { color: colors.bannerText }]}>
            Version {release.version} is available. <Text style={styles.link}>What's new</Text>
          </Text>
        )}
      </Pressable>
      {install.kind === "downloading" ? (
        <Pressable
          onPress={cancelInstall}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cancel the download"
        >
          <Text style={[styles.text, styles.link, { color: colors.bannerText }]}>Cancel</Text>
        </Pressable>
      ) : (
        !busy && (
          <Pressable
            onPress={dismiss}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Dismiss update notice"
          >
            <Ionicons name="close" size={20} color={colors.bannerText} />
          </Pressable>
        )
      )}
      <ReleaseNotesModal visible={notesOpen} onClose={() => setNotesOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, gap: 10 },
  main: { flex: 1 },
  text: { fontSize: 13 },
  link: { fontWeight: "700", textDecorationLine: "underline" },
});
