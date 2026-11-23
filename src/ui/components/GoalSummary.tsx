import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Goal } from "../../domain";
import {
  assistsLabel,
  gameGoalTag,
  goalTags,
  groupGoalsByPeriod,
  scoreAfterLabel,
  scorerGameGoalNumbers,
  scorerLabel,
  seasonGoalLabel,
} from "../goals";
import { tabular, useColors, DIVIDER } from "../theme";
import { goalVideoLabel, isOpenableVideoUrl } from "../videos";
import { openVideo } from "../videos-native";

/**
 * Goal-by-goal summary: time, team, scorer with their goal of the game ("(2)") and tags ("PP", "Hat trick"), which
 * goal of the season it was ("9th goal"), assists, the score after the goal, and a play button when the league has
 * the goal's video (opened in a browser tab).
 */
export function GoalSummary({ goals }: { goals: Goal[] }) {
  const colors = useColors();
  if (goals.length === 0) return null;
  const numbers = scorerGameGoalNumbers(goals);
  const gameGoal = new Map(goals.map((g, i) => [g, numbers[i]]));
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.muted }]}>Goals</Text>
      {groupGoalsByPeriod(goals).map((period) => (
        <View key={period.label}>
          <Text style={[styles.period, { color: colors.muted, borderTopColor: colors.border }]}>{period.label}</Text>
          {period.goals.map((goal, i) => {
            const n = gameGoal.get(goal) ?? 0;
            // "PP EN · Hat trick"
            const tags = [goalTags(goal).join(" "), gameGoalTag(n)].filter(Boolean).join(" · ");
            const season = seasonGoalLabel(goal);
            const score = scoreAfterLabel(goal);
            return (
              <View key={`${goal.time}-${goal.scorer.id}-${i}`} style={styles.row}>
                <Text style={[styles.time, tabular, { color: colors.muted }]}>{goal.time}</Text>
                <Text style={[styles.team, { color: colors.text }]}>{goal.teamId}</Text>
                <View style={styles.main}>
                  {/* Two lines: a long name with tags ("PP · Hat trick") can run long on narrow screens. */}
                  <Text style={[styles.scorer, { color: colors.text }]} numberOfLines={2}>
                    {scorerLabel(goal, n)}
                    {tags !== "" && <Text style={{ color: colors.accent }}>{`  ${tags}`}</Text>}
                  </Text>
                  {season && <Text style={[styles.season, { color: colors.muted }]}>{season}</Text>}
                  <Text style={[styles.assists, { color: colors.muted }]} numberOfLines={1}>
                    {assistsLabel(goal)}
                  </Text>
                </View>
                {score && <Text style={[styles.score, tabular, { color: colors.text }]}>{score}</Text>}
                {isOpenableVideoUrl(goal.videoUrl) && (
                  <Pressable
                    onPress={() => goal.videoUrl && openVideo(goal.videoUrl, colors.card)}
                    hitSlop={8}
                    accessibilityRole="link"
                    accessibilityLabel={goalVideoLabel(goal)}
                    style={styles.play}
                  >
                    <Ionicons name="play-circle-outline" size={24} color={colors.accent} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  title: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", paddingVertical: 6 },
  period: {
    fontSize: 12,
    fontWeight: "600",
    paddingTop: 8,
    paddingBottom: 2,
    borderTopWidth: DIVIDER,
  },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  time: { width: 46, fontSize: 13 },
  team: { width: 42, fontSize: 13, fontWeight: "700" },
  main: { flex: 1 },
  scorer: { fontSize: 14 },
  season: { fontSize: 12, fontWeight: "600", marginTop: 1 },
  assists: { fontSize: 12, marginTop: 1 },
  score: { fontSize: 13, fontWeight: "600", marginLeft: 8 },
  play: { marginLeft: 10 },
});
