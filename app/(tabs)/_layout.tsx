import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { shouldShowOnboarding } from "../../src/ui/onboarding";
import { useSettings } from "../../src/ui/settings-context";

type IconName = ComponentProps<typeof Ionicons>["name"];

const icon =
  (name: IconName) =>
  // The tab bar always passes a color string; its type is wider than Ionicons accepts.
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  );

export default function TabsLayout() {
  const { settings, loaded } = useSettings();
  // The splash screen stays up until settings are read, so render nothing until then: no tab mounts (or fetches)
  // before we know whether this is a fresh install. A fresh install goes to first-run setup instead.
  if (!loaded) return null;
  if (shouldShowOnboarding(loaded, settings.onboardingComplete)) return <Redirect href="/welcome" />;
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Scores", tabBarIcon: icon("calendar-outline") }} />
      <Tabs.Screen name="standings" options={{ title: "Standings", tabBarIcon: icon("list-outline") }} />
      <Tabs.Screen name="leaders" options={{ title: "Leaders", tabBarIcon: icon("trophy-outline") }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: icon("settings-outline") }} />
    </Tabs>
  );
}
