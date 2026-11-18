import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { StatTable } from "../../domain";
import { statValue } from "../format";
import { tabular, useColors } from "../theme";

const NAME_WIDTH = 150;
const COLUMN_WIDTH = 48;

/**
 * Renders any StatTable without knowing the sport: the player column stays put and the
 * stat columns scroll sideways when they do not fit.
 */
export function StatTableView({ table }: { table: StatTable }) {
  const colors = useColors();
  if (table.rows.length === 0) return null;

  const names = (
    <View style={{ width: NAME_WIDTH }}>
      <Text style={[styles.header, { color: colors.muted }]}>{table.title}</Text>
      {table.rows.map((row) => (
        <View key={row.player.id} style={[styles.row, { borderTopColor: colors.border }]}>
          <Text numberOfLines={1} style={[styles.cell, { color: colors.text }]}>
            {row.player.name}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.inner}>
        {names}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.cols}>
              {table.columns.map((c) => (
                <Text key={c.key} style={[styles.header, styles.num, { color: colors.muted }]}>
                  {c.label}
                </Text>
              ))}
            </View>
            {table.rows.map((row) => (
              <View key={row.player.id} style={[styles.row, styles.cols, { borderTopColor: colors.border }]}>
                {table.columns.map((c) => (
                  <Text key={c.key} style={[styles.cell, styles.num, tabular, { color: colors.text }]}>
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
  cols: { flexDirection: "row" },
  header: { fontSize: 12, fontWeight: "700", paddingVertical: 6, textTransform: "uppercase" },
  row: { height: 34, justifyContent: "center", borderTopWidth: StyleSheet.hairlineWidth },
  cell: { fontSize: 14 },
  num: { width: COLUMN_WIDTH, textAlign: "right", paddingRight: 8 },
});
