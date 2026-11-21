import { StyleSheet, Text, View } from "react-native";
import type { Goal } from "../../domain";
import { assistsLabel, goalTags, groupGoalsByPeriod, scoreAfterLabel } from "../goals";
import { tabular, useColors } from "../theme";

/** Goal-by-goal summary: time, team, scorer with tags, assists and the score after the goal. */
export function GoalSummary({ goals }: { goals: Goal[] }) {
  const colors = useColors();
  if (goals.length === 0) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.muted }]}>Goals</Text>
      {groupGoalsByPeriod(goals).map((period) => (
        <View key={period.label}>
          <Text style={[styles.period, { color: colors.muted, borderTopColor: colors.border }]}>{period.label}</Text>
          {period.goals.map((goal, i) => {
            const tags = goalTags(goal);
            const score = scoreAfterLabel(goal);
            return (
              <View key={`${goal.time}-${goal.scorer.id}-${i}`} style={styles.row}>
                <Text style={[styles.time, tabular, { color: colors.muted }]}>{goal.time}</Text>
                <Text style={[styles.team, { color: colors.text }]}>{goal.teamId}</Text>
                <View style={styles.main}>
                  <Text style={[styles.scorer, { color: colors.text }]} numberOfLines={1}>
                    {goal.scorer.name}
                    {tags.length > 0 && <Text style={{ color: colors.accent }}>{`  ${tags.join(" ")}`}</Text>}
                  </Text>
                  <Text style={[styles.assists, { color: colors.muted }]} numberOfLines={1}>
                    {assistsLabel(goal)}
                  </Text>
                </View>
                {score && <Text style={[styles.score, tabular, { color: colors.text }]}>{score}</Text>}
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
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  time: { width: 46, fontSize: 13 },
  team: { width: 42, fontSize: 13, fontWeight: "700" },
  main: { flex: 1 },
  scorer: { fontSize: 14 },
  assists: { fontSize: 12, marginTop: 1 },
  score: { fontSize: 13, fontWeight: "600", marginLeft: 8 },
});
