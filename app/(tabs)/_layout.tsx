import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** A tab's icon: filled while the tab is selected, outlined otherwise. */
const icon =
  (filled: IconName, outline: IconName) =>
  // The tab bar always passes a color string; its type is wider than Ionicons accepts.
  ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} color={color as string} size={size} />
  );

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Scores", tabBarIcon: icon("calendar", "calendar-outline") }} />
      <Tabs.Screen name="standings" options={{ title: "Standings", tabBarIcon: icon("list", "list-outline") }} />
      <Tabs.Screen name="leaders" options={{ title: "Leaders", tabBarIcon: icon("trophy", "trophy-outline") }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: icon("settings", "settings-outline") }} />
    </Tabs>
  );
}
