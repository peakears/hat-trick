import { useEffect, useState } from "react";
import { Alert, FlatList, Linking, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import type { LogEntry } from "../src/data";
import { Empty } from "../src/ui/components/States";
import { consoleLine, logForIssue, logReport } from "../src/ui/data/diagnostics";
import { reportProblemUrl } from "../src/ui/common/links";
import { useDiagnosticsLog } from "../src/ui/data/sports-data-context";
import { useColors } from "../src/ui/theme/theme";
import { APP_VERSION } from "../src/ui/updates/update-context";

const INFO = { version: APP_VERSION, platform: Platform.OS, osVersion: Platform.Version };
/** The system monospace font: "monospace" on Android, Menlo on iOS. */
const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

/** Settings › Diagnostics: problems the app had loading data, to share in a report. Nothing leaves the phone unless shared. */
export default function DiagnosticsScreen() {
  const colors = useColors();
  const log = useDiagnosticsLog();
  const [entries, setEntries] = useState<LogEntry[] | undefined>();

  useEffect(() => {
    let active = true;
    log
      .list()
      .then((list) => active && setEntries(list))
      .catch(() => active && setEntries([]));
    // Problems found while the screen is open show up at once.
    const unsubscribe = log.subscribe((list) => setEntries(list));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [log]);

  const share = () => {
    if (entries) Share.share({ message: logReport(entries, INFO) }).catch(() => {});
  };
  const report = () => {
    Linking.openURL(reportProblemUrl(INFO, entries ? logForIssue(entries) : undefined)).catch(() => {});
  };
  const clear = () =>
    Alert.alert("Clear the log?", "This removes every entry.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => log.clear().catch(() => {}) },
    ]);

  const empty = entries !== undefined && entries.length === 0;

  return (
    <View style={styles.screen}>
      <Text style={[styles.intro, { color: colors.muted }]}>
        Problems the app had loading data from the NHL: fields it did not understand and requests that failed. Nothing
        here leaves your phone unless you share it.
      </Text>
      <View style={styles.actions}>
        <Action label="Report a problem" onPress={report} />
        <Action label="Share" onPress={share} disabled={empty} />
        <Action label="Clear" onPress={clear} disabled={empty} />
      </View>
      {entries === undefined ? null : empty ? (
        <Empty message="No problems recorded." />
      ) : (
        // One console-like panel, newest first. Each entry is selectable, so a long press copies it.
        <FlatList
          data={entries}
          keyExtractor={(e) => `${e.kind}|${e.key}|${e.url ?? ""}|${e.message}`}
          style={[styles.console, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          contentContainerStyle={styles.consoleContent}
          renderItem={({ item }) => {
            const line = consoleLine(item);
            const levelColor = line.level === "E" ? colors.live : colors.accent;
            return (
              <Text
                selectable
                style={[styles.line, { color: colors.text }]}
                accessibilityLabel={`${line.level === "E" ? "Request failed" : "Warning"}${line.count ? `, ${item.count} times` : ""}, ${line.where}: ${line.message}`}
              >
                <Text style={{ color: colors.muted }}>{line.time} </Text>
                <Text style={[styles.level, { color: levelColor }]}>{line.level}</Text>
                <Text style={{ color: levelColor }}>{line.count}</Text>
                <Text style={{ color: colors.muted }}> {line.where}</Text>
                {"\n  "}
                {line.message}
              </Text>
            );
          }}
        />
      )}
    </View>
  );
}

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[styles.actionText, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  intro: { fontSize: 13, marginHorizontal: 16, marginTop: 16 },
  actions: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  action: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  actionText: { fontSize: 14, fontWeight: "600" },
  console: { flex: 1, margin: 12, borderRadius: 10, borderWidth: 1 },
  consoleContent: { paddingVertical: 8, paddingHorizontal: 10, gap: 6 },
  line: { fontFamily: MONO, fontSize: 12, lineHeight: 17 },
  level: { fontWeight: "700" },
});
