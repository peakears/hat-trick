import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GamePerformer } from "../../domain";
import { playerRoute } from "../common/routes";
import { useSportsData } from "../data/sports-data-context";
import { useColors } from "../theme/theme";
import { PlayerHeadshot } from "./PlayerHeadshot";

/**
 * Each team's top performer, side by side: photo, name, team and their line ("45 PTS, 5 REB, 7 AST"). For leagues
 * without three stars. Each opens the player page, for a league that has one. The caller hides it behind the
 * spoiler shield.
 */
export function TopPerformers({ performers }: { performers: GamePerformer[] }) {
  const colors = useColors();
  const router = useRouter();
  const sports = useSportsData();
  if (performers.length === 0) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.muted }]} accessibilityRole="header">
        Top performers
      </Text>
      <View style={styles.row}>
        {performers.map((p) => {
          const opens = sports.supports(p.player.league, "player");
          return (
            <Pressable
              key={`${p.teamId}-${p.player.id}`}
              onPress={opens ? () => router.push(playerRoute(p.player)) : undefined}
              disabled={!opens}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: colors.surfaceSunken, opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityRole={opens ? "button" : undefined}
              accessibilityLabel={`${p.player.name}, ${p.teamId}: ${p.line}${opens ? ". Open player page" : ""}`}
            >
              <PlayerHeadshot player={p.player} size={40} />
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {p.player.name}
              </Text>
              <Text style={[styles.team, { color: colors.muted }]}>
                {p.teamId}
                {p.player.position ? ` · ${p.player.position}` : ""}
              </Text>
              <Text style={[styles.line, { color: colors.text }]} numberOfLines={2}>
                {p.line}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, marginHorizontal: 12, marginTop: 8, paddingVertical: 6, paddingHorizontal: 12 },
  title: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", paddingVertical: 6 },
  row: { flexDirection: "row", gap: 8, paddingBottom: 6 },
  tile: { flex: 1, borderRadius: 10, padding: 10, gap: 4 },
  name: { fontSize: 14, fontWeight: "600", marginTop: 4 },
  team: { fontSize: 12 },
  line: { fontSize: 13, fontWeight: "600" },
});
