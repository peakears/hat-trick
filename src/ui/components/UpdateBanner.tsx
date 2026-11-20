import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { installStatusText, isBusy } from "../install-update";
import { useColors } from "../theme";
import { useUpdate } from "../update-context";

/**
 * A slim banner on Scores when a newer release exists. Tapping it downloads and installs the update
 * (or opens the download in the browser where the app cannot install); the X closes it.
 */
export function UpdateBanner() {
  const colors = useColors();
  const { status, dismiss, install, installNow, openInBrowser, canInstallInApp } = useUpdate();
  if (status.kind !== "available" || status.dismissed) return null;
  const { release } = status;
  const busy = isBusy(install);
  const failed = install.kind === "failed";
  const action = canInstallInApp ? "Update" : "Download";

  return (
    <View style={[styles.banner, { backgroundColor: colors.banner }]}>
      <Pressable
        style={styles.main}
        onPress={failed ? openInBrowser : installNow}
        disabled={busy}
        accessibilityRole={failed ? "link" : "button"}
        accessibilityLabel={
          busy
            ? (installStatusText(install) ?? "Updating")
            : failed
              ? `${installStatusText(install)} Open the download in the browser`
              : `Version ${release.version} is available. ${action}`
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
            Version {release.version} is available. <Text style={styles.link}>{action}</Text>
          </Text>
        )}
      </Pressable>
      {!busy && (
        <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss update notice">
          <Ionicons name="close" size={20} color={colors.bannerText} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, gap: 10 },
  main: { flex: 1 },
  text: { fontSize: 13 },
  link: { fontWeight: "700", textDecorationLine: "underline" },
});
