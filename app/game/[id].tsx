import { Stack, useLocalSearchParams, type ErrorBoundaryProps } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { GameSide } from "../../src/domain";
import { RevealButton } from "../../src/ui/components/ShieldUi";
import { FavoriteStar } from "../../src/ui/components/FavoriteStar";
import { Segmented } from "../../src/ui/components/Segmented";
import { CrashScreen, Empty, ErrorView, Loading, OfflineBanner, UpdatedAt } from "../../src/ui/components/States";
import { StatTableView } from "../../src/ui/components/StatTableView";
import { TeamLogo } from "../../src/ui/components/TeamLogo";
import { WhereToWatch } from "../../src/ui/components/WhereToWatch";
import { teamRecord } from "../../src/ui/format";
import { useSpoilers } from "../../src/ui/spoiler-context";
import { LEAGUE, useSportsData } from "../../src/ui/sports-data-context";
import { tabular, useColors } from "../../src/ui/theme";
import { usePolled } from "../../src/ui/use-polled";

/** A box score that fails to render keeps the header, so Back still returns to the scores. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} retry={retry} />;
}

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sports = useSportsData();
  const colors = useColors();
  const spoilers = useSpoilers();
  const [side, setSide] = useState<"away" | "home">("away");
  const detail = usePolled(`game:${id}`, (o) => sports.getGameDetail(LEAGUE, id, o));
  // Season records come from the standings (shared with the Standings tab's cache). Optional:
  // if standings fail to load, the records are just left out.
  const standings = usePolled("standings", (o) => sports.getStandings(LEAGUE, o));

  if (detail.loading) return <Loading />;
  if (!detail.data) {
    return (
      <ErrorView
        title="Couldn't load this game"
        error={detail.error ?? new Error("Unknown error")}
        onRetry={detail.refresh}
      />
    );
  }

  const { game, boxscore } = detail.data;
  const live = game.status === "live";
  // While hidden: no score, shots, box score, and no records (the standings already count a finished game).
  const hidden = spoilers.isHidden(game);
  const tables = boxscore[side].filter((t) => t.rows.length > 0);

  const team = (s: GameSide) => {
    const record = hidden && game.status === "final" ? undefined : teamRecord(standings.data, s.team);
    return (
      <View style={styles.team}>
        <TeamLogo team={s.team} size={56} />
        <View style={styles.nameRow}>
          <Text style={[styles.teamName, { color: colors.text }]} numberOfLines={1}>
            {s.team.name}
          </Text>
          <FavoriteStar team={s.team} size={18} />
        </View>
        {record && (
          <Text
            style={[styles.record, tabular, { color: colors.muted }]}
            accessibilityLabel={`Season record ${record}`}
          >
            {record}
          </Text>
        )}
        {s.shotsOnGoal !== undefined && !hidden && (
          // A pill, so shots read as a live game stat rather than another line of team info.
          <View
            style={[styles.sogPill, { backgroundColor: colors.background, borderColor: colors.border }]}
            accessibilityLabel={`${s.shotsOnGoal} shots on goal`}
          >
            <Text style={[styles.sogValue, tabular, { color: colors.text }]}>{s.shotsOnGoal}</Text>
            <Text style={[styles.sogLabel, { color: colors.muted }]}>SOG</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: `${game.away.team.abbrev} @ ${game.home.team.abbrev}` }} />
      <OfflineBanner meta={detail.meta} />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={detail.refreshing} onRefresh={detail.refresh} colors={[colors.accent]} />
        }
      >
        <View style={[styles.summary, { backgroundColor: colors.card }]}>
          {team(game.away)}
          <View style={styles.middle}>
            {hidden ? (
              <Text style={[styles.hiddenScore, { color: colors.muted }]}>Score hidden</Text>
            ) : (
              <Text style={[styles.score, tabular, { color: colors.text }]}>
                {game.away.score ?? "-"} – {game.home.score ?? "-"}
              </Text>
            )}
            <Text style={[styles.status, tabular, { color: live ? colors.live : colors.muted }]}>
              {spoilers.statusLabel(game)}
            </Text>
            {hidden && <RevealButton label="Show score" onPress={() => spoilers.reveal(game.id)} />}
          </View>
          {team(game.home)}
        </View>

        <WhereToWatch game={game} />

        {hidden ? (
          <Empty message="Box score hidden by the spoiler shield. Tap Show score to see it." />
        ) : (
          <Segmented
            options={[
              { value: "away", label: game.away.team.abbrev },
              { value: "home", label: game.home.team.abbrev },
            ]}
            value={side}
            onChange={setSide}
          />
        )}
        {hidden ? null : tables.length === 0 ? (
          <Empty message={game.status === "scheduled" ? "Box score starts at puck drop." : "No box score yet."} />
        ) : (
          tables.map((t) => <StatTableView key={t.title} table={t} />)
        )}
        <UpdatedAt meta={detail.meta} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  team: { flex: 1, alignItems: "center", gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
  teamName: { flexShrink: 1, fontSize: 14, fontWeight: "600" },
  record: { fontSize: 12, fontWeight: "600" },
  sogPill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sogValue: { fontSize: 14, fontWeight: "700" },
  sogLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 0.5 },
  middle: { alignItems: "center", paddingHorizontal: 8, gap: 4 },
  score: { fontSize: 30, fontWeight: "800" },
  hiddenScore: { fontSize: 16, fontWeight: "600" },
  status: { fontSize: 13, fontWeight: "600" },
});
