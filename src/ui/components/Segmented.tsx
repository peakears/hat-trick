import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "../theme/theme";

/** A small switch of a few options, e.g. Skaters | Goalies. Labels shrink to fit on narrow screens. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.border }]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.option, selected && { backgroundColor: colors.card }]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ color: selected ? colors.text : colors.muted, fontWeight: "600" }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", borderRadius: 10, padding: 3, margin: 12 },
  option: { flex: 1, alignItems: "center", paddingVertical: 7, paddingHorizontal: 4, borderRadius: 8 },
});
