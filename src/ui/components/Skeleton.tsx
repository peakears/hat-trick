import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { useColors, DIVIDER } from "../theme/theme";
import { useReduceMotion } from "../theme/use-reduce-motion";

/**
 * Loading placeholders: grey shapes in the layout of the screen that is loading, pulsing gently, so
 * a screen looks like it is arriving rather than blank. With "Remove animations" on they hold still.
 * One pulse is shared by every block of a placeholder, so the blocks breathe together.
 */

const Pulse = createContext<Animated.Value | Animated.AnimatedInterpolation<number> | number>(1);

function SkeletonRoot({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReduceMotion();
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, value]);
  const opacity = reduceMotion ? 0.7 : value.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  return (
    <Pulse.Provider value={opacity}>
      {/* One "Loading" for screen readers instead of a list of empty shapes. */}
      <View style={style} accessible accessibilityLabel="Loading" accessibilityRole="progressbar">
        {children}
      </View>
    </Pulse.Provider>
  );
}

/** One grey shape. */
export function Bone({
  width = "100%",
  height = 12,
  radius = 6,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const opacity = useContext(Pulse);
  return (
    <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.border, opacity }, style]} />
  );
}

/** Game cards, as on the Scores tab. */
export function ScoresSkeleton({ count = 4 }: { count?: number }) {
  const colors = useColors();
  const team = (nameWidth: DimensionValue) => (
    <View style={styles.teamRow}>
      <Bone width={28} height={28} radius={14} />
      <Bone width={nameWidth} height={14} />
      <View style={styles.flex} />
      <Bone width={18} height={18} radius={4} />
    </View>
  );
  return (
    <SkeletonRoot style={styles.scores}>
      <Bone width={90} height={12} style={styles.sectionLabel} />
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.gameCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.gameTeams}>
            {team(i % 2 ? "55%" : "45%")}
            {team(i % 2 ? "40%" : "60%")}
          </View>
          <View style={[styles.gameStatus, { borderLeftColor: colors.border }]}>
            <Bone width={44} height={12} />
          </View>
        </View>
      ))}
    </SkeletonRoot>
  );
}

/** A header card (picture and title) and a few content cards: the game, team and player pages. */
export function PageSkeleton({ avatar = 56, cards = 2 }: { avatar?: number; cards?: number }) {
  const colors = useColors();
  return (
    <SkeletonRoot>
      <View style={[styles.card, styles.header, { backgroundColor: colors.card }]}>
        <Bone width={avatar} height={avatar} radius={avatar / 2} />
        <View style={styles.headerText}>
          <Bone width="70%" height={20} />
          <Bone width="45%" height={12} />
        </View>
      </View>
      {Array.from({ length: cards }, (_, c) => (
        <View key={c}>
          <Bone width={110} height={11} style={styles.sectionLabel} />
          <View style={[styles.card, styles.lines, { backgroundColor: colors.card }]}>
            {[80, 62, 74, 55].map((w, i) => (
              <Bone key={i} width={`${w - c * 6}%`} height={13} />
            ))}
          </View>
        </View>
      ))}
    </SkeletonRoot>
  );
}

/** Rows with a small picture, a name and a value: Standings, Leaders, the box score. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  const colors = useColors();
  return (
    <SkeletonRoot>
      <Bone width={120} height={12} style={styles.sectionLabel} />
      <View style={[styles.card, { backgroundColor: colors.card, paddingVertical: 4 }]}>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={[styles.listRow, i > 0 && { borderTopColor: colors.border, borderTopWidth: DIVIDER }]}>
            <Bone width={14} height={12} />
            <Bone width={24} height={24} radius={12} />
            <Bone width={`${45 + ((i * 17) % 30)}%`} height={13} />
            <View style={styles.flex} />
            <Bone width={28} height={13} />
          </View>
        ))}
      </View>
    </SkeletonRoot>
  );
}

/** Division headings over a grid of team logos: the team picker in first-run setup. */
export function TeamGridSkeleton({ groups = 2 }: { groups?: number }) {
  return (
    <SkeletonRoot>
      {Array.from({ length: groups }, (_, g) => (
        <View key={g}>
          <Bone width={100} height={12} style={styles.sectionLabel} />
          <View style={styles.grid}>
            {Array.from({ length: 8 }, (_, i) => (
              <View key={i} style={styles.gridTile}>
                <Bone width={44} height={44} radius={22} />
                <Bone width={32} height={10} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </SkeletonRoot>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scores: { paddingTop: 4 },
  sectionLabel: { marginHorizontal: 16, marginTop: 14, marginBottom: 6 },
  gameCard: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 12,
    marginVertical: 9,
  },
  gameTeams: { flex: 1, gap: 12, paddingVertical: 14, paddingLeft: 14, paddingRight: 12 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  gameStatus: {
    width: 84,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  card: { marginHorizontal: 12, marginTop: 8, borderRadius: 12, padding: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12 },
  headerText: { flex: 1, gap: 10 },
  lines: { gap: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: 8 },
  gridTile: { width: "25%", alignItems: "center", gap: 8, paddingVertical: 10 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
});
