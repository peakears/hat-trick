import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CrashScreen } from "../src/ui/components/States";
import { useLiveTracking } from "../src/ui/notifications/use-live-tracking";
import { useReminderSync, useReminderTaps } from "../src/ui/notifications/use-reminders";
import { SettingsProvider } from "../src/ui/settings/settings-context";
import { SpoilerProvider } from "../src/ui/spoilers/spoiler-context";
import { SportsDataProvider } from "../src/ui/data/sports-data-context";
import { UpdateProvider } from "../src/ui/updates/update-context";
import { useColors, useScheme } from "../src/ui/theme/theme";

/** Catches a render error anywhere in the app, so a release build never shows a blank screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} retry={retry} />;
}

/**
 * Mounted inside the providers: schedules puck drop reminders, starts the live score service when a favourite
 * plays, and opens the game when one of their notifications is tapped.
 */
function Reminders() {
  useReminderSync();
  useReminderTaps();
  useLiveTracking();
  return null;
}

/**
 * Navigation colours (headers, tab bar, screen backgrounds) from the current palette. Inside
 * SettingsProvider, so "Pure black" and the accent apply to the navigation too.
 */
function ThemedStack() {
  const scheme = useScheme();
  const colors = useColors();
  const base = scheme === "light" ? DefaultTheme : DarkTheme;
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
    <ThemeProvider value={theme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="game/[id]/index" options={{ title: "Game" }} />
        <Stack.Screen name="game/[id]/box-score" options={{ title: "Box score" }} />
        <Stack.Screen name="game/[id]/plays" options={{ title: "Play-by-play" }} />
        <Stack.Screen name="team/[id]" options={{ title: "Team" }} />
        <Stack.Screen name="player/[id]" options={{ title: "Player" }} />
        <Stack.Screen name="spotlight" options={{ title: "Player spotlight" }} />
        <Stack.Screen name="diagnostics" options={{ title: "Diagnostics" }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false, animation: "fade" }} />
      </Stack>
      <Reminders />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <SpoilerProvider>
        <SportsDataProvider>
          <UpdateProvider>
            <ThemedStack />
          </UpdateProvider>
        </SportsDataProvider>
      </SpoilerProvider>
    </SettingsProvider>
  );
}
