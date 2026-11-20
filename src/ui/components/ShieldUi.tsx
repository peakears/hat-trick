import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSpoilers } from "../spoiler-context";
import { useColors } from "../theme";

/** A small text button that reveals something the spoiler shield is hiding. */
export function RevealButton({ label, onPress, hint }: { label: string; onPress: () => void; hint?: string }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <Text style={[styles.reveal, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Wraps a whole tab (Standings, Leaders) whose numbers give away results. While the shield hides it, nothing is
 * rendered, so nothing is fetched either. "Show" opens it until the app closes.
 */
export function SpoilerGate({ what, children }: { what: string; children: ReactNode }) {
  const colors = useColors();
  const { tablesHidden, revealTables } = useSpoilers();
  if (!tablesHidden) return <>{children}</>;
  return (
    <View style={[styles.gate, { backgroundColor: colors.background }]}>
      <Text style={[styles.gateTitle, { color: colors.text }]}>{what} hidden</Text>
      <Text style={[styles.gateText, { color: colors.muted }]}>
        Spoiler shield is on, and {what.toLowerCase()} show the results of recent games.
      </Text>
      <Pressable
        onPress={revealTables}
        style={[styles.gateButton, { borderColor: colors.accent }]}
        accessibilityRole="button"
        accessibilityLabel={`Show ${what.toLowerCase()}`}
      >
        <Text style={{ color: colors.accent, fontWeight: "600" }}>Show {what.toLowerCase()}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  reveal: { fontSize: 12, fontWeight: "600" },
  gate: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  gateTitle: { fontSize: 17, fontWeight: "600" },
  gateText: { fontSize: 14, textAlign: "center" },
  gateButton: { marginTop: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
});
