import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { StatColumn } from "../../domain";
import { statValue } from "../common/format";
import { tabular, useColors, DIVIDER } from "../theme/theme";
import { columnWidth } from "./stat-grid-layout";

const NAME_WIDTH = 150;
/** Both halves' header rows share this height (labels are one line), so the rows below stay in line. */
const HEADER_HEIGHT = 28;

export interface StatGridRow {
  key: string;
  /** The fixed first column: a player name, a season, a game. */
  label: string;
  /** A smaller second line under the label. */
  detail?: string;
  /** Keyed by StatColumn.key; a missing key shows "-". */
  values: Record<string, string | number>;
  /** Makes the label a link (a player page, a game). */
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * A stats table for any sport: the first column stays put and the stat columns scroll sideways
 * when they do not fit. Rows with `onPress` open something when their label is tapped.
 */
export function StatGrid({ title, columns, rows }: { title: string; columns: StatColumn[]; rows: StatGridRow[] }) {
  const colors = useColors();
  if (rows.length === 0) return null;
  const rowHeight = rows.some((r) => r.detail) ? 44 : 34;
  const rowStyle = [styles.row, { height: rowHeight, borderTopColor: colors.border }];

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.inner}>
        <View style={{ width: NAME_WIDTH }}>
          <Text numberOfLines={1} style={[styles.header, { color: colors.muted }]}>
            {title}
          </Text>
          {rows.map((row) => {
            const text = (
              <>
                <Text numberOfLines={1} style={[styles.cell, { color: row.onPress ? colors.accent : colors.text }]}>
                  {row.label}
                </Text>
                {row.detail ? (
                  <Text numberOfLines={1} style={[styles.detail, { color: colors.muted }]}>
                    {row.detail}
                  </Text>
                ) : null}
              </>
            );
            return row.onPress ? (
              <Pressable
                key={row.key}
                onPress={row.onPress}
                style={rowStyle}
                accessibilityRole="button"
                accessibilityLabel={row.accessibilityLabel ?? row.label}
              >
                {text}
              </Pressable>
            ) : (
              <View key={row.key} style={rowStyle}>
                {text}
              </View>
            );
          })}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.cols}>
              {columns.map((c) => (
                <Text
                  key={c.key}
                  numberOfLines={1}
                  style={[styles.header, styles.num, { width: columnWidth(c.label), color: colors.muted }]}
                >
                  {c.label}
                </Text>
              ))}
            </View>
            {rows.map((row) => (
              <View key={row.key} style={[rowStyle, styles.cols]}>
                {columns.map((c) => (
                  <Text
                    key={c.key}
                    style={[styles.cell, styles.num, tabular, { width: columnWidth(c.label), color: colors.text }]}
                  >
                    {statValue(row.values[c.key])}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, marginHorizontal: 12, marginBottom: 12, paddingVertical: 6, paddingLeft: 12 },
  inner: { flexDirection: "row" },
  cols: { flexDirection: "row", alignItems: "center" },
  header: {
    height: HEADER_HEIGHT,
    lineHeight: HEADER_HEIGHT,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  row: { justifyContent: "center", borderTopWidth: DIVIDER },
  cell: { fontSize: 14 },
  detail: { fontSize: 11, marginTop: 1 },
  num: { textAlign: "right", paddingRight: 8 },
});
