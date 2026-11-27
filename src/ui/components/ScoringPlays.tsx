import { StyleSheet, Text, View } from "react-native";
import type { Game, Play } from "../../domain";
import { playPeriods } from "../game/plays";
import { DIVIDER, useColors } from "../theme/theme";
import { PlayRow } from "./PlayRow";

/**
 * Every score of the game in order, by period, for a league whose scores are not goals (football's touchdowns and
 * field goals): the clock, the team, what happened, its kind ("Touchdown") and the score after it. The caller hides
 * it behind the spoiler shield.
 */
export function ScoringPlays({ plays, game }: { plays: Play[]; game: Game }) {
  const colors = useColors();
  if (plays.length === 0) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.muted }]} accessibilityRole="header">
        Scoring
      </Text>
      {playPeriods(plays, { filter: "all", newestFirst: false }).map((period) => (
        <View key={period.label}>
          <Text style={[styles.period, { color: colors.muted, borderTopColor: colors.border }]}>{period.label}</Text>
          {period.plays.map((play, i) => (
            <PlayRow key={play.id} play={play} game={game} first={i === 0} />
          ))}
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
  period: { fontSize: 12, fontWeight: "600", paddingTop: 8, paddingBottom: 2, borderTopWidth: DIVIDER },
});
