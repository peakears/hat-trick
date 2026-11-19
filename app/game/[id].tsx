import { Stack, useLocalSearchParams, type ErrorBoundaryProps } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { GameSide } from "../../src/domain";
import { Segmented } from "../../src/ui/components/Segmented";
import { CrashScreen, Empty, ErrorView, Loading, OfflineBanner, UpdatedAt } from "../../src/ui/components/States";
import { StatTableView } from "../../src/ui/components/StatTableView";
import { TeamLogo } from "../../src/ui/components/TeamLogo";
import { gameStatusLabel } from "../../src/ui/format";
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
  const [side, setSide] = useState<"away" | "home">("away");
  const detail = usePolled(`game:${id}`, (o) => sports.getGameDetail(LEAGUE, id, o));

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
  const tables = boxscore[side].filter((t) => t.rows.length > 0);

  const team = (s: GameSide) => (
    <View style={styles.team}>
      <TeamLogo team={s.team} size={56} />
      <Text style={[styles.teamName, { color: colors.text }]} numberOfLines={1}>
        {s.team.name}
      </Text>
      {s.shotsOnGoal !== undefined && (
        <Text style={[styles.sog, { color: colors.muted }]}>{s.shotsOnGoal} SOG</Text>
      )}
    </View>
  );

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
            <Text style={[styles.score, tabular, { color: colors.text }]}>
              {game.away.score ?? "-"} – {game.home.score ?? "-"}
            </Text>
            <Text style={[styles.status, tabular, { color: live ? colors.live : colors.muted }]}>
              {gameStatusLabel(game)}
            </Text>
          </View>
          {team(game.home)}
        </View>

        <Segmented
          options={[
            { value: "away", label: game.away.team.abbrev },
            { value: "home", label: game.home.team.abbrev },
          ]}
          value={side}
          onChange={setSide}
        />
        {tables.length === 0 ? (
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
  teamName: { fontSize: 14, fontWeight: "600" },
  sog: { fontSize: 12 },
  middle: { alignItems: "center", paddingHorizontal: 8, gap: 4 },
  score: { fontSize: 30, fontWeight: "800" },
  status: { fontSize: 13, fontWeight: "600" },
});
