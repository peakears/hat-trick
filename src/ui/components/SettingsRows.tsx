import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { TV_REGIONS, type TvRegionPreference } from "../broadcasts";
import { ACCENTS, ACCENT_LABELS, accentSwatch, type AccentId } from "../palette";
import { requestReminderPermission } from "../reminders-native";
import type { ThemePreference } from "../settings";
import { useSettings } from "../settings-context";
import { useColors, useScheme, DIVIDER } from "../theme";

/** Controls shared by the Settings tab and first-run setup, so a choice looks the same in both. */

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const TV_REGION_LABELS: Record<TvRegionPreference, string> = { auto: "Auto", CA: "Canada", US: "US" };
export const TV_REGION_OPTIONS = TV_REGIONS.map((value) => ({ value, label: TV_REGION_LABELS[value] }));

/**
 * Turning reminders on asks for the notification permission first; they stay off if it is refused, and
 * `permissionDenied` says so.
 */
export function useReminderToggle() {
  const { update } = useSettings();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const setReminders = async (enabled: boolean) => {
    if (enabled && !(await requestReminderPermission().catch(() => false))) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);
    update({ remindersEnabled: enabled });
  };
  return { setReminders, permissionDenied };
}

/** A titled card of rows. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title.toUpperCase()}</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>{children}</View>
    </View>
  );
}

export function ToggleRow({
  label,
  detail,
  value,
  onChange,
  disabled = false,
  last = false,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.row, !last && styles.divider, !last && { borderBottomColor: colors.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: disabled ? colors.muted : colors.text }]}>{label}</Text>
        {detail ? <Text style={[styles.detail, { color: colors.muted }]}>{detail}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.accent }}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** Round swatches for the accent colour, in the shades the current theme uses. */
export function AccentPicker({
  value,
  onChange,
  last = false,
}: {
  value: AccentId;
  onChange: (accent: AccentId) => void;
  last?: boolean;
}) {
  const colors = useColors();
  const scheme = useScheme();
  return (
    <View style={[styles.row, !last && styles.divider, !last && { borderBottomColor: colors.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: colors.text }]}>Accent colour</Text>
        <Text style={[styles.detail, { color: colors.muted }]}>Links, buttons and highlights.</Text>
        <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel="Accent colour">
          {ACCENTS.map((accent) => {
            const selected = accent === value;
            return (
              <Pressable
                key={accent}
                onPress={() => onChange(accent)}
                hitSlop={4}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={ACCENT_LABELS[accent]}
                style={[styles.swatchRing, { borderColor: selected ? colors.text : "transparent" }]}
              >
                <View style={[styles.swatch, { backgroundColor: accentSwatch(accent, scheme) }]}>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.onAccent} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export const settingsStyles = StyleSheet.create({
  section: { gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginLeft: 4 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  rowText: { flex: 1, gap: 2 },
  label: { fontSize: 16 },
  detail: { fontSize: 13 },
  divider: { borderBottomWidth: DIVIDER },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  swatchRing: { borderRadius: 999, borderWidth: 2, padding: 2 },
  swatch: { width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});

const styles = settingsStyles;
