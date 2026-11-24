import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { shouldShowOnboarding } from "../../src/ui/settings/onboarding";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LEAGUE_BAR_HEIGHT, LeagueMenu } from "../../src/ui/components/LeagueMenu";
import { useSettings } from "../../src/ui/settings/settings-context";

type IconName = ComponentProps<typeof Ionicons>["name"];

const icon =
  (name: IconName) =>
  // The tab bar always passes a color string; its type is wider than Ionicons accepts.
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  );

const leagueMenu = () => <LeagueMenu />;
// The tab bar already names the page, so the league tabs' header holds only the league menu.
const noTitle = () => null;

export default function TabsLayout() {
  const { settings, loaded } = useSettings();
  const insets = useSafeAreaInsets();
  // A slim bar: it holds only the league menu. Its height includes the status bar.
  const leagueBar = {
    headerLeft: leagueMenu,
    headerTitle: noTitle,
    headerStyle: { height: insets.top + LEAGUE_BAR_HEIGHT },
  };
  // The splash screen stays up until settings are read, so render nothing until then: no tab mounts (or fetches)
  // before we know whether this is a fresh install. A fresh install goes to first-run setup instead.
  if (!loaded) return null;
  if (shouldShowOnboarding(loaded, settings.onboardingComplete)) return <Redirect href="/welcome" />;
  return (
    <Tabs>
      {/* The league tabs share one league menu in the header, with no title; Settings is for every league. */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Scores",
          tabBarIcon: icon("calendar-outline"),
          ...leagueBar,
        }}
      />
      <Tabs.Screen name="standings" options={{ title: "Standings", tabBarIcon: icon("list-outline"), ...leagueBar }} />
      <Tabs.Screen name="leaders" options={{ title: "Leaders", tabBarIcon: icon("trophy-outline"), ...leagueBar }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: icon("settings-outline") }} />
    </Tabs>
  );
}
