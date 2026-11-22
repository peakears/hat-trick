import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState, type ComponentType } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewNavigation, type WebViewProps } from "react-native-webview";
import { Empty } from "../src/ui/components/States";
import { useColors } from "../src/ui/theme";
import { isOpenableVideoUrl, videoNavigation } from "../src/ui/videos";
import { openVideo } from "../src/ui/videos-native";

// The package types WebView as `Component<WebViewProps & P>` with `P = undefined`, which makes its props `never`.
const VideoWebView = WebView as unknown as ComponentType<WebViewProps>;

/**
 * Best effort: once the page has loaded, bring the first video player into view, since the league's video page may
 * open with a header above it. Does nothing on a page without one. `true;` is required by WebView's injected scripts.
 */
const SCROLL_TO_PLAYER = `
setTimeout(function () {
  var v = document.querySelector("video");
  if (v && v.scrollIntoView) v.scrollIntoView({ block: "center" });
}, 1200);
true;`;

/**
 * Plays a game or goal video without leaving the app: the league's own video page in a WebView, which can go full
 * screen. Only pages on the video's own site load here; other https links open in the browser, and anything else is
 * blocked. "Open in browser" in the header is the fallback when the page does not play.
 */
export default function VideoScreen() {
  const { url, title } = useLocalSearchParams<{ url?: string; title?: string }>();
  const colors = useColors();
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  if (!isOpenableVideoUrl(url)) return <Empty message="This video can't be opened." />;

  const onNavigate = (req: WebViewNavigation & { isTopFrame?: boolean }) => {
    // Frames inside the page (the player, consent dialogs) load freely; the check is for where the page itself goes.
    if (req.isTopFrame === false) return true;
    const action = videoNavigation(url, req.url);
    if (action === "browser") void openVideo(req.url, colors.card);
    return action === "stay";
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: title || "Video",
          headerRight: () => (
            <Pressable
              onPress={() => openVideo(url, colors.card)}
              hitSlop={10}
              accessibilityRole="link"
              accessibilityLabel="Open in browser"
            >
              <Ionicons name="open-outline" size={22} color={colors.accent} />
            </Pressable>
          ),
        }}
      />
      {failed ? (
        <View style={styles.center}>
          <Text style={[styles.message, { color: colors.text }]}>This video didn't load.</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                setFailed(false);
                setLoading(true);
                setAttempt((n) => n + 1);
              }}
              accessibilityRole="button"
              style={[styles.button, { borderColor: colors.accent }]}
            >
              <Text style={[styles.buttonText, { color: colors.accent }]}>Try again</Text>
            </Pressable>
            <Pressable
              onPress={() => openVideo(url, colors.card)}
              accessibilityRole="link"
              style={[styles.button, { borderColor: colors.accent }]}
            >
              <Text style={[styles.buttonText, { color: colors.accent }]}>Open in browser</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <VideoWebView
            key={attempt}
            source={{ uri: url }}
            style={[styles.web, { backgroundColor: colors.background }]}
            originWhitelist={["https://*", "about:*"]}
            onShouldStartLoadWithRequest={onNavigate}
            onLoadEnd={() => setLoading(false)}
            onError={() => setFailed(true)}
            onHttpError={(e: { nativeEvent: { statusCode: number } }) => {
              if (e.nativeEvent.statusCode >= 400) setFailed(true);
            }}
            injectedJavaScript={SCROLL_TO_PLAYER}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
            allowFileAccess={false}
            javaScriptCanOpenWindowsAutomatically={false}
          />
          {loading && (
            <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
              <Ionicons name="play-circle-outline" size={56} color={colors.muted} />
              <Text style={[styles.message, { color: colors.muted }]}>Loading video…</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  web: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  message: { fontSize: 15, textAlign: "center" },
  actions: { flexDirection: "row", gap: 12 },
  button: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  buttonText: { fontWeight: "600" },
});
