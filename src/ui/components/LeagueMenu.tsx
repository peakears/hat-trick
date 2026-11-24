import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSportsData } from "../data/sports-data-context";
import { useLeague } from "../data/use-league";
import { useSettings } from "../settings/settings-context";
import { SCRIM_OPACITY } from "../theme/palette";
import { useColors } from "../theme/theme";

/**
 * Height of the league tabs' slim header bar, below the status bar (the default is 64 on Android). The tabs layout
 * sets it, and the menu drops down just under it.
 */
export const LEAGUE_BAR_HEIGHT = 44;

/**
 * The league menu at the top left of the Scores, Standings and Leaders tabs: a menu button that shows the current
 * league ("☰ NHL") and drops down a list of the leagues the app has. The pick is a setting, so all three tabs follow
 * it and it survives a restart. With a single league there is nothing to pick, so nothing is drawn.
 */
export function LeagueMenu() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const sports = useSportsData();
  const league = useLeague();
  const { update } = useSettings();
  const [open, setOpen] = useState(false);
  const leagues = sports.leagues();
  if (leagues.length < 2) return null;

  const pick = (id: string) => {
    update({ league: id });
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={`League: ${sports.leagueName(league)}. Change league`}
        accessibilityState={{ expanded: open }}
      >
        <Ionicons name="menu" size={22} color={colors.text} />
        <Text style={[styles.buttonLabel, { color: colors.text }]}>{league.toUpperCase()}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close league menu">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: SCRIM_OPACITY }]} />
          {/* A press inside the panel must not reach the backdrop and close the menu. */}
          <Pressable
            style={[
              styles.panel,
              { top: insets.top + LEAGUE_BAR_HEIGHT, backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            accessibilityRole="menu"
          >
            <Text style={[styles.heading, { color: colors.muted }]}>LEAGUE</Text>
            {leagues.map((id, i) => {
              const selected = id === league;
              return (
                <Pressable
                  key={id}
                  onPress={() => pick(id)}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                  accessibilityLabel={sports.leagueName(id)}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.abbrev, { color: selected ? colors.accent : colors.text }]}>
                      {id.toUpperCase()}
                    </Text>
                    <Text style={[styles.name, { color: colors.muted }]}>{sports.leagueName(id)}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark" size={20} color={colors.accent} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 16 },
  buttonLabel: { fontSize: 15, fontWeight: "700" },
  backdrop: { flex: 1 },
  panel: {
    position: "absolute",
    left: 12,
    width: 280,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    overflow: "hidden",
    elevation: 6,
  },
  heading: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginHorizontal: 14, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  rowText: { flex: 1, gap: 2 },
  abbrev: { fontSize: 16, fontWeight: "700" },
  name: { fontSize: 13 },
});
