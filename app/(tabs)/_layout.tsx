import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

const icon =
  (name: IconName) =>
  // The tab bar always passes a color string; its type is wider than Ionicons accepts.
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Scores", tabBarIcon: icon("calendar-outline") }} />
      <Tabs.Screen name="standings" options={{ title: "Standings", tabBarIcon: icon("list-outline") }} />
      <Tabs.Screen name="leaders" options={{ title: "Leaders", tabBarIcon: icon("trophy-outline") }} />
    </Tabs>
  );
}
