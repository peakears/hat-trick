import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { shouldShowOnboarding } from "../../src/ui/settings/onboarding";
import { LeagueBar } from "../../src/ui/components/LeagueBar";
import { useSettings } from "../../src/ui/settings/settings-context";
import { useColors } from "../../src/ui/theme/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

/**
 * A tab's icon: outlined, or filled on a soft accent pill when its tab is the one shown, so the selected tab reads
 * by shape and fill as well as colour.
 */
const icon =
  (outline: IconName, filled: IconName) =>
  // The tab bar always passes a color string; its type is wider than Ionicons accepts.
  ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <TabIcon name={focused ? filled : outline} color={color as string} size={size} focused={focused} />
  );

function TabIcon({ name, color, size, focused }: { name: IconName; color: string; size: number; focused: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.pill, focused && { backgroundColor: colors.tabSelected }]}>
      <Ionicons name={name} color={color} size={size} />
    </View>
  );
}

// The tab bar already names the page, so the league tabs' header is the league row alone. Scores draws its own
// (LeagueBar with its date, for the day's game counts), so it has no navigation header.
const leagueBar = { header: () => <LeagueBar /> };

export default function TabsLayout() {
  const { settings, loaded } = useSettings();
  const colors = useColors();
  // The splash screen stays up until settings are read, so render nothing until then: no tab mounts (or fetches)
  // before we know whether this is a fresh install. A fresh install goes to first-run setup instead.
  if (!loaded) return null;
  if (shouldShowOnboarding(loaded, settings.onboardingComplete)) return <Redirect href="/welcome" />;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: styles.label,
        // Room for the pill: the tab bar sizes the icon's box to the icon otherwise.
        tabBarIconStyle: styles.iconBox,
      }}
    >
      {/* The league tabs start with the league row; Settings is for every league. */}
      <Tabs.Screen
        name="index"
        options={{ title: "Scores", tabBarIcon: icon("calendar-outline", "calendar"), headerShown: false }}
      />
      <Tabs.Screen
        name="standings"
        options={{ title: "Standings", tabBarIcon: icon("list-outline", "list"), ...leagueBar }}
      />
      <Tabs.Screen
        name="leaders"
        options={{ title: "Leaders", tabBarIcon: icon("trophy-outline", "trophy"), ...leagueBar }}
      />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: icon("settings-outline", "settings") }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Wide enough for the pill to read as one, centred on the icon.
  pill: { width: 56, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, fontWeight: "600" },
  iconBox: { width: 56, height: 28 },
});
