import Ionicons from "@expo/vector-icons/Ionicons";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform, Pressable } from "react-native";
import { dateToPickerValue, pickerValueToDate } from "../format";
import { useColors } from "../theme";

/**
 * Calendar button that opens the native Android date dialog. The dialog follows the app's
 * light/dark mode. Its "Today" button calls onToday, so the Scores tab goes back to following today.
 * Android only: the app ships for Android, and iOS would need an inline picker instead.
 */
export function DatePickerButton({
  date,
  onPick,
  onToday,
}: {
  date: string;
  onPick: (date: string) => void;
  onToday: () => void;
}) {
  const colors = useColors();
  if (Platform.OS !== "android") return null;

  const open = () =>
    DateTimePickerAndroid.open({
      value: dateToPickerValue(date),
      mode: "date",
      neutralButton: { label: "Today" },
      onChange: (event, value) => {
        if (event.type === "neutralButtonPressed") onToday();
        else if (event.type === "set" && value) onPick(pickerValueToDate(value));
      },
    });

  return (
    <Pressable onPress={open} hitSlop={12} accessibilityRole="button" accessibilityLabel="Pick a date">
      <Ionicons name="calendar-outline" size={20} color={colors.accent} />
    </Pressable>
  );
}
