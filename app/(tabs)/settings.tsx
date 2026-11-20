import Constants from "expo-constants";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Segmented } from "../../src/ui/components/Segmented";
import type { ThemePreference } from "../../src/ui/settings";
import { useSettings } from "../../src/ui/settings-context";
import { useColors } from "../../src/ui/theme";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function SettingsScreen() {
  const colors = useColors();
  const { settings, update } = useSettings();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Section title="Theme">
        <Segmented options={THEME_OPTIONS} value={settings.theme} onChange={(theme) => update({ theme })} />
      </Section>

      <Section title="Display">
        <ToggleRow
          label="Show team logos"
          detail="Off shows team abbreviations instead."
          value={settings.showLogos}
          onChange={(showLogos) => update({ showLogos })}
        />
        <ToggleRow
          label="Show betting info"
          detail="Odds and lines, when available. Coming in a later version."
          value={settings.showBetting}
          onChange={(showBetting) => update({ showBetting })}
          last
        />
      </Section>

      <Section title="Favourite teams">
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.text }]}>
              {settings.favoriteTeams.length > 0 ? settings.favoriteTeams.join(", ") : "None yet"}
            </Text>
            <Text style={[styles.detail, { color: colors.muted }]}>
              Star a team on the Standings tab or a game page. Their games show first on Scores.
            </Text>
          </View>
          {settings.favoriteTeams.length > 0 && (
            <Pressable
              onPress={() => update({ favoriteTeams: [] })}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear favourite teams"
            >
              <Text style={[styles.label, { color: colors.accent }]}>Clear</Text>
            </Pressable>
          )}
        </View>
      </Section>

      <Text style={[styles.footer, { color: colors.muted }]}>
        Hat Trick {Constants.expoConfig?.version ?? ""}
        {"\n"}Not affiliated with the NHL or any team.
      </Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title.toUpperCase()}</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>{children}</View>
    </View>
  );
}

function ToggleRow({
  label,
  detail,
  value,
  onChange,
  last = false,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {detail ? <Text style={[styles.detail, { color: colors.muted }]}>{detail}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent }}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginLeft: 4 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  rowText: { flex: 1, gap: 2 },
  label: { fontSize: 16 },
  detail: { fontSize: 13 },
  footer: { textAlign: "center", fontSize: 12, lineHeight: 18 },
});
