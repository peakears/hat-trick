import { Pressable, StyleSheet, Text } from "react-native";
import { useColors } from "../theme/theme";

/** A small text button that reveals something the spoiler shield is hiding. */
export function RevealButton({ label, onPress, hint }: { label: string; onPress: () => void; hint?: string }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <Text style={[styles.reveal, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  reveal: { fontSize: 12, fontWeight: "600" },
});
