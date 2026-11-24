import { Pressable, StyleSheet, Text, View } from "react-native";
import { dateLabel } from "../common/format";
import { fullDateLabel, weekStrip } from "../scores/week-strip";
import { scoreFont, scoreFontSemiBold } from "../theme/fonts";
import { DIVIDER, useColors } from "../theme/theme";
import { DatePickerButton } from "./DatePickerButton";

/**
 * The top of the Scores tab: the chosen day in words ("TUESDAY 24 NOVEMBER" over "Today"), a calendar button for any
 * date, and a strip of the seven days around the chosen one. Tapping a day or the heading picks a date the same way
 * the swipe and the calendar do; tapping the heading goes back to today. Logic in scores/week-strip.ts.
 */
export function WeekStrip({
  date,
  today,
  onPick,
  onToday,
}: {
  date: string;
  today: string;
  onPick: (date: string) => void;
  onToday: () => void;
}) {
  const colors = useColors();
  const days = weekStrip(date, today);
  return (
    <View style={[styles.box, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={styles.headRow}>
        <Pressable
          onPress={onToday}
          style={styles.heading}
          accessibilityRole="button"
          accessibilityLabel={`${fullDateLabel(date, today)}${date === today ? ", today" : ""}. Go to today`}
        >
          <Text style={[styles.caption, { color: colors.muted }]}>{fullDateLabel(date, today).toUpperCase()}</Text>
          <Text style={[styles.title, scoreFont, { color: colors.text }]}>{dateLabel(date, today)}</Text>
        </Pressable>
        {/* Picking today goes through onPick, so it stores no fixed date and keeps following today. */}
        <DatePickerButton date={date} onPick={onPick} onToday={onToday} />
      </View>
      <View style={styles.strip} accessibilityRole="tablist" accessibilityLabel="Days">
        {days.map((d) => (
          <Pressable
            key={d.date}
            onPress={() => onPick(d.date)}
            style={({ pressed }) => [
              styles.day,
              d.selected && { backgroundColor: colors.tabSelected, borderColor: colors.accent },
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: d.selected }}
            accessibilityLabel={d.spoken}
          >
            <Text style={[styles.weekday, { color: d.selected ? colors.text : colors.muted }]}>{d.weekday}</Text>
            {/* Today's number in the accent colour (on the card), so it can be found from any other day. */}
            <Text
              style={[
                styles.dayNumber,
                scoreFontSemiBold,
                { color: d.selected ? colors.text : d.isToday ? colors.accent : colors.muted },
              ]}
            >
              {d.day}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, borderBottomWidth: DIVIDER, gap: 8 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4 },
  heading: { flex: 1 },
  caption: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  title: { fontSize: 26, lineHeight: 30 },
  strip: { flexDirection: "row", gap: 4 },
  day: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  weekday: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4 },
  dayNumber: { fontSize: 18, lineHeight: 22 },
});
