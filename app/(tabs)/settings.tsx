import { useState, type ReactNode } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { TV_REGIONS, type TvRegionPreference } from "../../src/ui/broadcasts";
import { ReleaseNotesModal } from "../../src/ui/components/ReleaseNotesModal";
import { Segmented } from "../../src/ui/components/Segmented";
import { timeLabel } from "../../src/ui/format";
import { installStatusText, isBusy } from "../../src/ui/install-update";
import { RELEASES_URL, REPO_URL, reportProblemUrl } from "../../src/ui/links";
import { requestReminderPermission } from "../../src/ui/reminders-native";
import { REMINDER_LEADS, type ReminderLead, type ThemePreference } from "../../src/ui/settings";
import { useSettings } from "../../src/ui/settings-context";
import type { UpdateStatus } from "../../src/ui/updates";
import { useColors } from "../../src/ui/theme";
import { APP_VERSION, useUpdate } from "../../src/ui/update-context";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const TV_REGION_LABELS: Record<TvRegionPreference, string> = { auto: "Auto", CA: "Canada", US: "US" };
const TV_REGION_OPTIONS = TV_REGIONS.map((value) => ({ value, label: TV_REGION_LABELS[value] }));

const LEAD_OPTIONS = REMINDER_LEADS.map((n) => ({ value: String(n), label: `${n} min` }));

export default function SettingsScreen() {
  const colors = useColors();
  const { settings, update } = useSettings();
  const { status, checking, checkNow, install, installNow, cancelInstall, openInBrowser, canInstallInApp } =
    useUpdate();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  // Turning reminders on asks for the notification permission first; it stays off if refused.
  const setReminders = async (enabled: boolean) => {
    if (enabled && !(await requestReminderPermission().catch(() => false))) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);
    update({ remindersEnabled: enabled });
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Section title="Theme">
        <Segmented options={THEME_OPTIONS} value={settings.theme} onChange={(theme) => update({ theme })} />
      </Section>

      <Section title="Display">
        <ToggleRow
          label="Show logos and photos"
          detail="Team logos and player photos. Off shows abbreviations and initials instead."
          value={settings.showLogos}
          onChange={(showLogos) => update({ showLogos })}
        />
        <ToggleRow
          label="Show Original 6 tags"
          detail="The Original 6 Series tag on games between the six oldest teams. Other special games stay tagged."
          value={settings.showOriginalSixTags}
          onChange={(showOriginalSixTags) => update({ showOriginalSixTags })}
        />
        <ToggleRow
          label="Show betting info"
          detail="Odds and lines, when available. Coming in a later version."
          value={settings.showBetting}
          onChange={(showBetting) => update({ showBetting })}
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

      <Section title="Favourite teams">
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.text }]}>
              {settings.favoriteTeams.length > 0 ? settings.favoriteTeams.join(", ") : "None yet"}
            </Text>
            <Text style={[styles.detail, { color: colors.muted }]}>
              Star a team on the Standings tab or a game page. Their games show first on Scores.
            </Text>
          </View>
          {settings.favoriteTeams.length > 0 && (
            <Pressable
              onPress={() => update({ favoriteTeams: [] })}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear favourite teams"
            >
              <Text style={[styles.label, { color: colors.accent }]}>Clear</Text>
            </Pressable>
          )}
        </View>
      </Section>

      <Section title="Reminders">
        <ToggleRow
          label="Puck drop reminders"
          detail={
            permissionDenied
              ? "Notifications are blocked. Allow them for Hat Trick in your phone's settings, then try again."
              : settings.favoriteTeams.length === 0
                ? "Notifies you before your favourite teams' games. Star a team first."
                : "Notifies you before your favourite teams' games."
          }
          value={settings.remindersEnabled}
          onChange={setReminders}
          last={!settings.remindersEnabled}
        />
        {settings.remindersEnabled && (
          <View style={styles.row}>
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
      </Section>

      <Section title="About">
        <View style={[styles.row, styles.divider, { borderBottomColor: colors.border }]}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: colors.text }]}>Hat Trick {APP_VERSION}</Text>
            <Text style={[styles.detail, { color: colors.muted }]}>
              {installStatusText(install) ?? updateDetail(status, checking)}
            </Text>
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
          detail="Asks GitHub for the latest release at most once a day. Nothing is downloaded until you tap Update."
          value={settings.checkForUpdates}
          onChange={(checkForUpdates) => update({ checkForUpdates })}
        />
        <LinkRow label="GitHub repository" detail="peakears/hat-trick" url={REPO_URL} />
        {status.kind === "available" ? (
          <Pressable
            onPress={() => setNotesOpen(true)}
            accessibilityRole="button"
            style={[styles.row, styles.divider, { borderBottomColor: colors.border }]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: colors.text }]}>What's new in {status.release.version}</Text>
            </View>
          </Pressable>
        ) : (
          <LinkRow label="Release notes" url={RELEASES_URL} />
        )}
        <ReleaseNotesModal visible={notesOpen} onClose={() => setNotesOpen(false)} />
        <LinkRow
          label="Report a problem"
          detail="Opens a new issue with your app version filled in."
          url={reportProblemUrl({ version: APP_VERSION, platform: Platform.OS, osVersion: Platform.Version })}
          last
        />
      </Section>

      <Text style={[styles.footer, { color: colors.muted }]}>Not affiliated with the NHL or any team.</Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title.toUpperCase()}</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>{children}</View>
    </View>
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

function ToggleRow({
  label,
  detail,
  value,
  onChange,
  last = false,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {detail ? <Text style={[styles.detail, { color: colors.muted }]}>{detail}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent }} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginLeft: 4 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  rowText: { flex: 1, gap: 2 },
  label: { fontSize: 16 },
  detail: { fontSize: 13 },
  leadPicker: { flex: 1 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
  linkText: { fontWeight: "600" },
  footer: { textAlign: "center", fontSize: 12, lineHeight: 18 },
});
