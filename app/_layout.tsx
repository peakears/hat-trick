import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { CrashScreen } from "../src/ui/components/States";
import { SettingsProvider } from "../src/ui/settings-context";
import { SportsDataProvider } from "../src/ui/sports-data-context";
import { darkColors, lightColors } from "../src/ui/theme";

/** Catches a render error anywhere in the app, so a release build never shows a blank screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} retry={retry} />;
}

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
    <SettingsProvider>
      <SportsDataProvider>
        <ThemeProvider value={theme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="game/[id]" options={{ title: "Game" }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </SportsDataProvider>
    </SettingsProvider>
  );
}
