import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { Game, Play } from "../../domain";
import { playScoreLabel, playSpoken } from "../game/plays";
import { tabular, useColors, DIVIDER } from "../theme/theme";
import { TeamLogo } from "./TeamLogo";

/**
 * One play: time, team logo, what happened. A goal is bold, with its tag ("Power play") and the score after it;
 * plays that are neither shots, goals nor penalties (hits, faceoffs, stoppages) are muted. Used by the game page's
 * card and the full play-by-play page.
 */
export function PlayRow({
  play,
  game,
  first,
  style,
}: {
  play: Play;
  game: Game;
  /** The first row of its group draws no divider above it. */
  first: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const team = [game.away.team, game.home.team].find((t) => t.id === play.teamId);
  const scoreLabel = playScoreLabel(play);
  return (
    <View
      style={[styles.row, !first && { borderTopColor: colors.border, borderTopWidth: DIVIDER }, style]}
      accessible
      accessibilityLabel={playSpoken(play)}
    >
      <Text style={[styles.time, tabular, { color: colors.muted }]}>{play.time}</Text>
      <View style={styles.logo}>{team && <TeamLogo team={team} size={20} />}</View>
      <View style={styles.main}>
        <Text
          style={[
            styles.text,
            { color: play.kind === "other" ? colors.muted : colors.text },
            play.kind === "score" && styles.bold,
          ]}
        >
          {play.text}
        </Text>
        {play.tag && <Text style={[styles.tag, { color: colors.accent }]}>{play.tag}</Text>}
      </View>
      {scoreLabel && <Text style={[styles.score, tabular, { color: colors.text }]}>{scoreLabel}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9 },
  time: { width: 44, fontSize: 13 },
  logo: { width: 22, alignItems: "center" },
  main: { flex: 1 },
  text: { fontSize: 14 },
  bold: { fontWeight: "700" },
  tag: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  score: { fontSize: 14, fontWeight: "700", marginLeft: 6 },
});
