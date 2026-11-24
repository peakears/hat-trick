import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ReleaseNotesModal } from "../../src/ui/components/ReleaseNotesModal";
import { Segmented } from "../../src/ui/components/Segmented";
import {
  AccentPicker,
  Section,
  THEME_OPTIONS,
  ToggleRow,
  TV_REGION_OPTIONS,
  useReminderToggle,
} from "../../src/ui/components/SettingsRows";
import { timeLabel } from "../../src/ui/common/format";
import { installStatusText, isBusy } from "../../src/ui/updates/install-update";
import { RELEASES_URL, REPO_URL, reportProblemUrl } from "../../src/ui/common/links";
import { liveTrackingAvailable } from "../../src/ui/notifications/live-tracker-native";
import { REMINDER_LEADS, type ReminderLead } from "../../src/ui/settings/settings";
import { useSettings } from "../../src/ui/settings/settings-context";
import type { UpdateStatus } from "../../src/ui/updates/updates";
import { useColors, DIVIDER } from "../../src/ui/theme/theme";
import { favoritesLabel } from "../../src/ui/team/favorites";
import { APP_VERSION, useUpdate } from "../../src/ui/updates/update-context";

const LEAD_OPTIONS = REMINDER_LEADS.map((n) => ({ value: String(n), label: `${n} min` }));

/** The Favourite teams row: "TOR, MTL" (by league with more than one league), or "None yet". */
function favoritesSummary(favorites: readonly string[]): string {
  return favorites.length > 0 ? favoritesLabel(favorites) : "None yet";
}

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { settings, update } = useSettings();
  const { status, checking, checkNow, install, installNow, cancelInstall, openInBrowser, canInstallInApp } =
    useUpdate();
  const { setReminders, setLiveScores, permissionDenied } = useReminderToggle();
  const [notesOpen, setNotesOpen] = useState(false);

  // Live scores also need the notification permission; the service only exists in the installed Android app.
  const liveAvailable = liveTrackingAvailable();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Section title="Theme">
        <View style={[styles.divider, { borderBottomColor: colors.border }]}>
          <Segmented options={THEME_OPTIONS} value={settings.theme} onChange={(theme) => update({ theme })} />
        </View>
        <ToggleRow
          label="Pure black (OLED)"
          detail="A black background whenever the app is dark. Saves battery on OLED screens."
          value={settings.pureBlack}
          onChange={(pureBlack) => update({ pureBlack })}
        />
        <AccentPicker value={settings.accent} onChange={(accent) => update({ accent })} last />
      </Section>

      <Section title="Display">
        <ToggleRow
          label="Show logos and photos"
          detail="Team logos and player photos. Off shows abbreviations and initials instead."
          value={settings.showLogos}
          onChange={(showLogos) => update({ showLogos })}
          last
        />
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
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.text }]}>Show channels for</Text>
            <Text style={[styles.detail, { color: colors.muted }]}>
              Auto uses your phone's region. Pick a country if it's wrong, for example when travelling.
            </Text>
          </View>
        </View>
        <Segmented
          options={TV_REGION_OPTIONS}
          value={settings.tvRegion}
          onChange={(tvRegion) => update({ tvRegion })}
        />
      </Section>

      <Section title="Notifications">
        <ToggleRow
          label="Game start reminders"
          detail={
            permissionDenied
              ? "Notifications are blocked. Allow them for Hat Trick in your phone's settings, then try again."
              : settings.favoriteTeams.length === 0
                ? "A notification before your favourite teams' games. Star a team first."
                : "A notification before your favourite teams' games. Choose teams under Favourite teams."
          }
          value={settings.remindersEnabled}
          onChange={setReminders}
        />
        {settings.remindersEnabled && (
          <View style={[styles.row, styles.divider, { borderBottomColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.text }]}>Remind me</Text>
            <View style={styles.leadPicker}>
              <Segmented
                options={LEAD_OPTIONS}
                value={String(settings.reminderLeadMinutes)}
                onChange={(v) => update({ reminderLeadMinutes: Number(v) as ReminderLead })}
              />
            </View>
          </View>
        )}
        <ToggleRow
          label="Live scores"
          detail={
            !liveAvailable
              ? "Available in the installed Android app (not in Expo Go)."
              : settings.favoriteTeams.length === 0
                ? "Follows your favourite teams' games in a notification, even with the app closed. Star a team first."
                : "Follows your favourite teams' games in a notification, even with the app closed. Starts when you open the app, or a reminder, near game time."
          }
          value={liveAvailable && settings.liveScores}
          onChange={setLiveScores}
          disabled={!liveAvailable}
          last={!(liveAvailable && settings.liveScores)}
        />
        {liveAvailable && settings.liveScores && (
          <ToggleRow
            label="Scoring alerts"
            detail={
              settings.spoilerShield
                ? "Off while the spoiler shield is on."
                : "Each goal, with the scorer, in hockey; a change of lead late in the game and overtime in basketball; and the final score."
            }
            value={settings.goalAlerts}
            onChange={(goalAlerts) => update({ goalAlerts })}
            last
          />
        )}
      </Section>

      <Section title="Favourite teams">
        <Pressable
          onPress={() => router.push("/favorites")}
          accessibilityRole="button"
          accessibilityLabel={`Favourite teams: ${favoritesSummary(settings.favoriteTeams)}. Open`}
          style={styles.row}
        >
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.text }]}>{favoritesSummary(settings.favoriteTeams)}</Text>
            <Text style={[styles.detail, { color: colors.muted }]}>
              Their games show first on Scores. Choose reminders and live scores for each team.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </Section>

      <Section title="About">
        <View style={[styles.row, styles.divider, { borderBottomColor: colors.border }]}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.text }]}>Hat Trick {APP_VERSION}</Text>
            <View style={styles.statusLine}>
              <Text style={[styles.detail, styles.statusText, { color: colors.muted }]}>
                {installStatusText(install) ?? updateDetail(status, checking)}
              </Text>
              {/* A separate button beside the status, so "What's new" and "Update" stay two focusable controls. */}
              {status.kind === "available" ? (
                <Pressable
                  onPress={() => setNotesOpen(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`What's new in version ${status.release.version}`}
                >
                  <Text style={[styles.detail, styles.linkText, { color: colors.accent }]}>What's new</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => Linking.openURL(RELEASES_URL).catch(() => {})}
                  hitSlop={8}
                  accessibilityRole="link"
                  accessibilityLabel="Release notes"
                >
                  <Text style={[styles.detail, styles.linkText, { color: colors.accent }]}>Release notes</Text>
                </Pressable>
              )}
            </View>
          </View>
          {status.kind === "available" && install.kind === "downloading" ? (
            <Pressable
              onPress={cancelInstall}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel the download"
            >
              <Text style={[styles.label, styles.linkText, { color: colors.accent }]}>Cancel</Text>
            </Pressable>
          ) : status.kind === "available" ? (
            <Pressable
              onPress={install.kind === "failed" ? openInBrowser : installNow}
              disabled={isBusy(install)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${canInstallInApp ? "Update to" : "Download"} version ${status.release.version}`}
            >
              <Text style={[styles.label, styles.linkText, { color: isBusy(install) ? colors.muted : colors.accent }]}>
                {install.kind === "failed" ? "Open in browser" : canInstallInApp ? "Update" : "Download"}
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={checkNow} disabled={checking} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.label, styles.linkText, { color: checking ? colors.muted : colors.accent }]}>
                Check now
              </Text>
            </Pressable>
          )}
        </View>
        <ToggleRow
          label="Check for updates automatically"
          detail="Once a day at most, from GitHub. Nothing downloads until you tap Update."
          value={settings.checkForUpdates}
          onChange={(checkForUpdates) => update({ checkForUpdates })}
        />
        <LinkRow label="GitHub repository" detail="peakears/hat-trick" url={REPO_URL} />
        <ReleaseNotesModal visible={notesOpen} onClose={() => setNotesOpen(false)} />
        <Pressable
          onPress={() => router.push({ pathname: "/welcome", params: { again: "1" } })}
          accessibilityRole="button"
          style={[styles.row, styles.divider, { borderBottomColor: colors.border }]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.text }]}>Run setup again</Text>
            <Text style={[styles.detail, { color: colors.muted }]}>
              Favourite teams, theme and reminders. Your choices stay picked.
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push("/diagnostics")}
          accessibilityRole="button"
          style={[styles.row, styles.divider, { borderBottomColor: colors.border }]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.text }]}>Diagnostics</Text>
            <Text style={[styles.detail, { color: colors.muted }]}>
              Problems loading data. Stays on your phone unless you share it.
            </Text>
          </View>
        </Pressable>
        <LinkRow
          label="Report a problem"
          detail="Opens a GitHub issue with your app version. To attach the diagnostics log, report from Diagnostics."
          url={reportProblemUrl({ version: APP_VERSION, platform: Platform.OS, osVersion: Platform.Version })}
          last
        />
      </Section>

      <Text style={[styles.footer, { color: colors.muted }]}>
        Not affiliated with the NHL, the NBA, ESPN or any team.
      </Text>
    </ScrollView>
  );
}

/** What the About section says under the version. */
function updateDetail(status: UpdateStatus, checking: boolean): string {
  if (checking) return "Checking for updates...";
  switch (status.kind) {
    case "available":
      return `Version ${status.release.version} is available.`;
    case "up-to-date":
      return `Up to date. Checked at ${timeLabel(new Date(status.checkedAt).toISOString())}.`;
    case "error":
      return `${status.message}.`;
    case "unknown":
      return "Not checked yet.";
  }
}

/** A row that opens a web page in the browser. */
function LinkRow({
  label,
  detail,
  url,
  last = false,
}: {
  label: string;
  detail?: string;
  url: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      accessibilityRole="link"
      style={[styles.row, !last && styles.divider, !last && { borderBottomColor: colors.border }]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {detail ? <Text style={[styles.detail, { color: colors.muted }]}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  rowText: { flex: 1, gap: 2 },
  label: { fontSize: 16 },
  detail: { fontSize: 13 },
  leadPicker: { flex: 1 },
  divider: { borderBottomWidth: DIVIDER },
  linkText: { fontWeight: "600" },
  statusText: { flexShrink: 1 },
  statusLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 8 },
  footer: { textAlign: "center", fontSize: 12, lineHeight: 18 },
});
