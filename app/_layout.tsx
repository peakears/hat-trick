import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { SportsDataProvider } from "../src/ui/sports-data-context";
import { darkColors, lightColors } from "../src/ui/theme";

export default function RootLayout() {
  const dark = useColorScheme() === "dark";
  const base = dark ? DarkTheme : DefaultTheme;
  const colors = dark ? darkColors : lightColors;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <SportsDataProvider>
      <ThemeProvider value={theme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="game/[id]" options={{ title: "Game" }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SportsDataProvider>
  );
}
