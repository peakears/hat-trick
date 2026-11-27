import { RefreshControl, type RefreshControlProps } from "react-native";
import { useHaptic } from "../haptics/use-haptic";
import { useColors } from "../theme/theme";

/**
 * Pull to refresh for a ScrollView, FlatList or SectionList (`refreshControl={<PullToRefresh ... />}`): the spinner
 * in the accent colour on the card colour (so it matches dark and pure black), and a light tap when the pull is let
 * go. Every screen uses this rather than `RefreshControl`.
 *
 * Every other prop is passed on: on Android the scroll view clones this element and hands it the list itself as
 * `children`, with a `style`, so dropping them leaves the screen blank (only a device shows it; iOS does not nest).
 */
export function PullToRefresh({ onRefresh, ...rest }: RefreshControlProps) {
  const colors = useColors();
  const haptic = useHaptic();
  return (
    <RefreshControl
      {...rest}
      onRefresh={() => {
        haptic("refresh");
        onRefresh?.();
      }}
      colors={[colors.accent]}
      progressBackgroundColor={colors.card}
      tintColor={colors.accent}
    />
  );
}
