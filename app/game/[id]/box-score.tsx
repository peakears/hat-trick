import { Stack, useLocalSearchParams, type ErrorBoundaryProps } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { RevealButton } from "../../../src/ui/components/ShieldUi";
import { PullToRefresh } from "../../../src/ui/components/PullToRefresh";
import { Segmented } from "../../../src/ui/components/Segmented";
import { CrashScreen, Empty, ErrorView, Loading, OfflineBanner, UpdatedAt } from "../../../src/ui/components/States";
import { StatTableView } from "../../../src/ui/components/StatTableView";
import { useSpoilers } from "../../../src/ui/spoiler-context";
import { LEAGUE, useSportsData } from "../../../src/ui/sports-data-context";
import { useColors } from "../../../src/ui/theme";
import { usePolled } from "../../../src/ui/use-polled";

/** A box score that fails to render keeps the header, so Back still returns to the game. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} retry={retry} />;
}

/** Player stats for both teams. Shares the game page's data (same cache key), so opening it costs no extra request. */
export default function BoxScoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sports = useSportsData();
  const colors = useColors();
  const spoilers = useSpoilers();
  const [side, setSide] = useState<"away" | "home">("away");
  const detail = usePolled(`game:${id}`, (o) => sports.getGameDetail(LEAGUE, id, o));

  if (detail.loading) return <Loading />;
  if (!detail.data) {
    return (
      <ErrorView
        title="Couldn't load this box score"
        error={detail.error ?? new Error("Unknown error")}
        onRetry={detail.refresh}
      />
    );
  }

  const { game, boxscore } = detail.data;
  const hidden = spoilers.isHidden(game);
  const tables = boxscore[side].filter((t) => t.rows.length > 0);

  return (
    <>
      <Stack.Screen options={{ title: `${game.away.team.abbrev} @ ${game.home.team.abbrev} box score` }} />
      <OfflineBanner meta={detail.meta} />
      <ScrollView refreshControl={<PullToRefresh refreshing={detail.refreshing} onRefresh={detail.refresh} />}>
        {hidden ? (
          <View style={styles.hidden}>
            <Empty message="Box score hidden by the spoiler shield." />
            <RevealButton label="Show score" onPress={() => spoilers.reveal(game.id)} />
          </View>
        ) : (
          <>
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
          </>
        )}
        <UpdatedAt meta={detail.meta} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  hidden: { alignItems: "center", gap: 8 },
});
