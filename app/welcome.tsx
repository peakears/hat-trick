import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Team } from "../src/domain";
import { Segmented } from "../src/ui/components/Segmented";
import {
  AccentPicker,
  Section,
  settingsStyles,
  THEME_OPTIONS,
  ToggleRow,
  TV_REGION_OPTIONS,
  useReminderToggle,
} from "../src/ui/components/SettingsRows";
import { TeamGridSkeleton } from "../src/ui/components/Skeleton";
import { TeamLogo } from "../src/ui/components/TeamLogo";
import { favoritesFor, favoritesLabel, isFavorite } from "../src/ui/team/favorites";
import {
  nextStep,
  previousStep,
  reminderHint,
  stepProgress,
  teamsByDivision,
  type OnboardingStep,
} from "../src/ui/settings/onboarding";
import { REMINDER_LEADS, type ReminderLead } from "../src/ui/settings/settings";
import { useSettings } from "../src/ui/settings/settings-context";
import { NHL, useSportsData } from "../src/ui/data/sports-data-context";
import { useColors, DIVIDER } from "../src/ui/theme/theme";
import { usePolled } from "../src/ui/data/use-polled";

/**
 * First-run setup (issue #120): shown once on a fresh install, before the tabs (the tabs layout redirects here),
 * and again from Settings > Run setup again (`?again=1`). Every choice is saved the moment it is made, so leaving
 * part way keeps what was picked. Steps come from `onboarding.ts`.
 */
export default function WelcomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const rerun = useLocalSearchParams<{ again?: string }>().again === "1";
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const back = previousStep(step);
  const next = nextStep(step);

  // Leave only once `onboardingComplete` is in state: navigating in the same tick as the update could let the tabs
  // layout render with the old value and redirect straight back here.
  const [finishing, setFinishing] = useState(false);
  const finish = () => {
    if (!settings.onboardingComplete) update({ onboardingComplete: true });
    setFinishing(true);
  };
  useEffect(() => {
    if (!finishing || !settings.onboardingComplete) return;
    if (rerun && router.canGoBack()) router.back();
    else router.replace("/");
  }, [finishing, settings.onboardingComplete, rerun, router]);

  // Android's back button goes to the previous step rather than leaving setup.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!back) return false;
      setStep(back);
      return true;
    });
    return () => sub.remove();
  }, [back]);

  // Each step fades in (a fade, not a slide, so it is fine with reduce motion on).
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [step, opacity]);

  const progress = stepProgress(step);
  const primaryLabel =
    step === "welcome"
      ? "Get started"
      : step === "done"
        ? "Done"
        : step === "teams" && settings.favoriteTeams.length === 0
          ? "Skip for now"
          : "Next";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <View style={styles.topSide}>
          {back && step !== "done" && (
            <Pressable onPress={() => setStep(back)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={24} color={colors.accent} />
            </Pressable>
          )}
        </View>
        <View
          style={styles.dots}
          accessibilityLabel={progress ? `Step ${progress.index + 1} of ${progress.total}` : ""}
        >
          {progress &&
            Array.from({ length: progress.total }, (_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: i <= progress.index ? colors.accent : colors.border }]}
              />
            ))}
        </View>
        <View style={[styles.topSide, styles.topRight]}>
          {step !== "done" && (
            <Pressable onPress={finish} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.link, { color: colors.accent }]}>{rerun ? "Close" : "Skip setup"}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Animated.View style={[styles.flex, { opacity }]}>
        {step === "teams" ? (
          <TeamsStep />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {step === "welcome" && <WelcomeStep />}
            {step === "look" && <LookStep />}
            {step === "options" && <OptionsStep />}
            {step === "done" && <DoneStep />}
          </ScrollView>
        )}
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => (next ? setStep(next) : finish())}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.primaryText, { color: colors.onAccent }]}>{primaryLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StepHeading({ title, detail }: { title: string; detail: string }) {
  const colors = useColors();
  return (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{detail}</Text>
    </View>
  );
}

function WelcomeStep() {
  const colors = useColors();
  return (
    <View style={styles.centered}>
      <View style={[styles.badge, { backgroundColor: colors.accent }]}>
        <Ionicons name="star" size={40} color={colors.onAccent} />
      </View>
      <StepHeading
        title="Welcome to Hat Trick"
        detail="NHL scores, standings, leaders and box scores. Free and open source, with no account and no ads, and your settings stay on your phone."
      />
      <Text style={[styles.subtitle, styles.centerText, { color: colors.muted }]}>
        A few quick choices and you're in. You can change all of them later in Settings.
      </Text>
    </View>
  );
}

/** Tap teams to star them. The list is the Standings tab's cache entry, so this also loads that tab. */
function TeamsStep() {
  const colors = useColors();
  const sports = useSportsData();
  const { settings } = useSettings();
  const standings = usePolled(`${NHL}:standings`, (o) => sports.getStandings(NHL, o));
  const groups = teamsByDivision(standings.data);
  const count = settings.favoriteTeams.length;

  return (
    <ScrollView contentContainerStyle={styles.teamsContent}>
      <View style={styles.padded}>
        <StepHeading
          title="Pick your teams"
          detail={
            count > 0
              ? `${count} picked. Their games show first on Scores, and you can get reminders before puck drop.`
              : "Tap as many as you like. Their games show first on Scores, and you can get reminders before puck drop."
          }
        />
      </View>
      {standings.loading ? (
        <TeamGridSkeleton />
      ) : groups.length === 0 ? (
        <View style={[styles.padded, styles.errorBox]}>
          <Text style={[styles.subtitle, { color: colors.text }]}>
            Couldn't load the teams. Check your connection, or skip this step and star teams later from the Standings
            tab.
          </Text>
          <Pressable onPress={standings.refresh} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.link, { color: colors.accent }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        groups.map((group) => (
          <View key={`${group.conference ?? ""}|${group.title}`}>
            <Text
              accessibilityRole="header"
              style={[settingsStyles.sectionTitle, styles.groupTitle, { color: colors.muted }]}
            >
              {group.title.toUpperCase()}
            </Text>
            <View style={styles.grid}>
              {group.teams.map((team) => (
                <TeamTile key={team.id} team={team} />
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function TeamTile({ team }: { team: Team }) {
  const colors = useColors();
  const { settings, toggleFavoriteTeam } = useSettings();
  const picked = isFavorite(favoritesFor(NHL, settings.favoriteTeams), team.id);
  return (
    <Pressable
      onPress={() => toggleFavoriteTeam(NHL, team.id)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: picked }}
      accessibilityLabel={team.name}
      style={styles.tile}
    >
      <View style={[styles.tileRing, { borderColor: picked ? colors.accent : "transparent" }]}>
        <TeamLogo team={team} size={44} />
        {picked && (
          <View style={[styles.tileStar, { backgroundColor: colors.accent, borderColor: colors.background }]}>
            <Ionicons name="star" size={11} color={colors.onAccent} />
          </View>
        )}
      </View>
      <Text style={[styles.tileLabel, { color: picked ? colors.text : colors.muted }]}>{team.abbrev}</Text>
    </Pressable>
  );
}

function LookStep() {
  const colors = useColors();
  const { settings, update } = useSettings();
  return (
    <>
      <StepHeading title="Make it yours" detail="Changes show right away, on this screen too." />
      <Section title="Theme">
        <View style={[settingsStyles.row, settingsStyles.divider, { borderBottomColor: colors.border }]}>
          <View style={styles.flex}>
            <Segmented options={THEME_OPTIONS} value={settings.theme} onChange={(theme) => update({ theme })} />
          </View>
        </View>
        <ToggleRow
          label="Pure black (OLED)"
          detail="A black background whenever the app is dark. Saves battery on OLED screens."
          value={settings.pureBlack}
          onChange={(pureBlack) => update({ pureBlack })}
        />
        <AccentPicker value={settings.accent} onChange={(accent) => update({ accent })} last />
      </Section>
    </>
  );
}

const LEAD_OPTIONS = REMINDER_LEADS.map((n) => ({ value: String(n), label: `${n} min` }));

function OptionsStep() {
  const colors = useColors();
  const { settings, update } = useSettings();
  const { setReminders, permissionDenied } = useReminderToggle();
  const favorites = settings.favoriteTeams.length;
  return (
    <>
      <StepHeading title="Game options" detail="All off unless you turn them on." />
      <Section title="Reminders">
        <ToggleRow
          label="Puck drop reminders"
          detail={reminderHint(favorites, permissionDenied)}
          value={settings.remindersEnabled}
          onChange={setReminders}
          // Only asks for the notification permission when switched on, and only with a team to remind about.
          disabled={favorites === 0 && !settings.remindersEnabled}
          last={!settings.remindersEnabled}
        />
        {settings.remindersEnabled && (
          <View style={settingsStyles.row}>
            <Text style={[settingsStyles.label, { color: colors.text }]}>Remind me</Text>
            <View style={styles.flex}>
              <Segmented
                options={LEAD_OPTIONS}
                value={String(settings.reminderLeadMinutes)}
                onChange={(v) => update({ reminderLeadMinutes: Number(v) as ReminderLead })}
              />
            </View>
          </View>
        )}
      </Section>
      <Section title="Spoilers">
        <ToggleRow
          label="Spoiler shield"
          detail="Hides scores and box scores until you tap Show. Useful for watching games on delay."
          value={settings.spoilerShield}
          onChange={(spoilerShield) => update({ spoilerShield })}
          last
        />
      </Section>
      <Section title="TV channels">
        <View style={settingsStyles.row}>
          <View style={settingsStyles.rowText}>
            <Text style={[settingsStyles.label, { color: colors.text }]}>Show channels for</Text>
            <Text style={[settingsStyles.detail, { color: colors.muted }]}>Auto uses your phone's region.</Text>
          </View>
        </View>
        <Segmented
          options={TV_REGION_OPTIONS}
          value={settings.tvRegion}
          onChange={(tvRegion) => update({ tvRegion })}
        />
      </Section>
    </>
  );
}

function DoneStep() {
  const colors = useColors();
  const { settings } = useSettings();
  const teams = settings.favoriteTeams;
  return (
    <View style={styles.centered}>
      <View style={[styles.badge, { backgroundColor: colors.accent }]}>
        <Ionicons name="checkmark" size={44} color={colors.onAccent} />
      </View>
      <StepHeading
        title="You're all set"
        detail={
          teams.length > 0
            ? `Following ${favoritesLabel(teams)}. Change this or anything else in Settings.`
            : "Star a team any time from Standings or a game page. Everything else is in Settings."
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: 52 },
  topSide: { width: 96, flexDirection: "row" },
  topRight: { justifyContent: "flex-end" },
  dots: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  link: { fontSize: 15, fontWeight: "600" },
  content: { padding: 16, gap: 20, flexGrow: 1 },
  teamsContent: { paddingVertical: 16, gap: 4 },
  padded: { paddingHorizontal: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 8 },
  centerText: { textAlign: "center" },
  badge: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  heading: { gap: 8 },
  title: { fontSize: 26, fontWeight: "700" },
  subtitle: { fontSize: 15, lineHeight: 21 },
  errorBox: { gap: 12, marginTop: 16 },
  groupTitle: { marginHorizontal: 20, marginTop: 16, marginBottom: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: 8 },
  tile: { width: "25%", alignItems: "center", gap: 6, paddingVertical: 10 },
  tileRing: { borderRadius: 999, borderWidth: 2, padding: 4 },
  tileStar: {
    position: "absolute",
    right: -2,
    top: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: { fontSize: 13, fontWeight: "600" },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: DIVIDER },
  primary: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontSize: 16, fontWeight: "700" },
});
