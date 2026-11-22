import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { FLASH_MS, shouldFlash } from "../score-flash";
import { useColors } from "../theme";
import { useReduceMotion } from "../use-reduce-motion";

/**
 * A score that pops and glows in the accent colour when it goes up during a live game. `live`
 * should be false while the spoiler shield hides the game. Pass the text to draw as `children`
 * (a hidden score shows a dot), and the number as `value`. With "Remove animations" on, only the
 * glow fades in and out; nothing moves.
 */
export function FlashScore({
  value,
  live,
  style,
  containerStyle,
  children,
}: {
  value: number | null;
  live: boolean;
  /** The number's text style. Put margins in `containerStyle`, so the glow stays centred on the number. */
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const reduceMotion = useReduceMotion();
  const previous = useRef<number | null | undefined>(undefined);
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Always remember the latest value, even while not live or hidden, so revealing a game later never flashes it.
    const flash = shouldFlash(previous.current, value, live);
    previous.current = value;
    if (!flash) return;
    const pop = Animated.sequence([
      Animated.timing(scale, { toValue: 1.35, duration: FLASH_MS.grow, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]);
    const fade = Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: FLASH_MS.grow, useNativeDriver: true }),
      Animated.delay(FLASH_MS.glowHold),
      Animated.timing(glow, { toValue: 0, duration: FLASH_MS.glowFade, useNativeDriver: true }),
    ]);
    const animation = reduceMotion ? fade : Animated.parallel([pop, fade]);
    animation.start();
    return () => animation.stop();
  }, [value, live, reduceMotion, scale, glow]);

  return (
    <View style={containerStyle}>
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, { backgroundColor: colors.accent, opacity: Animated.multiply(glow, 0.22) }]}
      />
      <Animated.Text style={[style, { transform: [{ scale }] }]}>{children}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // A soft pill behind the number, a little larger than it.
  glow: { position: "absolute", top: -2, bottom: -2, left: -6, right: -6, borderRadius: 8 },
});
