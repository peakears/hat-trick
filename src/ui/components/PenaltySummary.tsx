import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Goal, Penalty } from "../../domain";
import {
  groupPenaltiesByPeriod,
  penaltyDetailLabel,
  penaltyLengthLabel,
  penaltyMinutesByTeam,
  penaltyPlayerLabel,
  powerPlayGoals,
  visiblePenalties,
} from "../penalties";
import { tabular, useColors, DIVIDER } from "../theme";

/**
 * Penalty-by-penalty summary: time, team, player, infraction and who drew it, length, and the power-play goal it led
 * to. The header totals each team's penalty minutes, away first like the rest of the game page. A long list shows its
 * first few penalties, with the rest behind "Show more"; the totals and power-play goals always count every penalty.
 */
export function PenaltySummary({
  penalties,
  goals,
  teamIds,
}: {
  penalties: Penalty[];
  goals?: Goal[];
  /** Away, then home. */
  teamIds: [string, string];
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  // Matched on the whole list, so a goal is never given to the wrong penalty while some are hidden.
  const ppGoals = powerPlayGoals(penalties, goals);
  const ppGoal = new Map(penalties.map((p, i) => [p, ppGoals[i]]));
  const totals = penaltyMinutesByTeam(penalties, teamIds)
    .map((t) => `${t.teamId} ${t.minutes}`)
    .join(" · ");
  const { shown, more } = visiblePenalties(penalties, expanded);
  const canToggle = expanded || more > 0;
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.muted }]}>Penalties</Text>
        {penalties.length > 0 && (
          <Text
            style={[styles.totals, tabular, { color: colors.muted }]}
            accessibilityLabel={`Penalty minutes: ${totals}`}
          >
            {`PIM  ${totals}`}
          </Text>
        )}
      </View>
      {penalties.length === 0 && <Text style={[styles.none, { color: colors.muted }]}>No penalties</Text>}
      {groupPenaltiesByPeriod(shown).map((period) => (
        <View key={period.label}>
          <Text style={[styles.period, { color: colors.muted, borderTopColor: colors.border }]}>{period.label}</Text>
          {period.penalties.map((penalty, i) => {
            const goal = ppGoal.get(penalty);
            return (
              <View key={`${penalty.time}-${penalty.teamId}-${i}`} style={styles.row}>
                <Text style={[styles.time, tabular, { color: colors.muted }]}>{penalty.time}</Text>
                <Text style={[styles.team, { color: colors.text }]}>{penalty.teamId}</Text>
                <View style={styles.main}>
                  <Text style={[styles.player, { color: colors.text }]} numberOfLines={1}>
                    {penaltyPlayerLabel(penalty)}
                  </Text>
                  <Text style={[styles.detail, { color: colors.muted }]} numberOfLines={2}>
                    {penaltyDetailLabel(penalty)}
                  </Text>
                  {goal && (
                    <Text style={[styles.ppGoal, { color: colors.accent }]} numberOfLines={1}>
                      {`PP goal: ${goal.scorer.name} ${goal.time}`}
                    </Text>
                  )}
                </View>
                <Text style={[styles.length, tabular, { color: colors.text }]}>{penaltyLengthLabel(penalty)}</Text>
              </View>
            );
          })}
        </View>
      ))}
      {canToggle && (
        <Pressable
          onPress={() => setExpanded(!expanded)}
          hitSlop={8}
          style={[styles.toggle, { borderTopColor: colors.border }]}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? "Show fewer penalties" : `Show ${more} more penalties`}
        >
          <Text style={[styles.toggleText, { color: colors.accent }]}>
            {expanded ? "Show fewer" : `Show ${more} more`}
          </Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.accent} />
        </Pressable>
      )}
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", paddingVertical: 6 },
  totals: { fontSize: 12, fontWeight: "600" },
  none: { fontSize: 13, paddingBottom: 6 },
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
  player: { fontSize: 14 },
  detail: { fontSize: 12, marginTop: 1 },
  ppGoal: { fontSize: 12, fontWeight: "600", marginTop: 1 },
  length: { fontSize: 13, fontWeight: "600", marginLeft: 8 },
  // The same toggle as the team page's game lists.
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: DIVIDER,
  },
  toggleText: { fontSize: 13, fontWeight: "600" },
});
