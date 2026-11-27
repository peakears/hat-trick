// StatGrid's column sizes (pure; tested in stat-grid-layout.test.ts).

/** The narrowest stat column: room for "17/29" or ".925". */
export const MIN_COLUMN_WIDTH = 48;

/** About the width of one upper-case header character (12 px, bold), plus the cell's right padding. */
const CHAR_WIDTH = 8;
const PADDING = 12;

/**
 * A stat column's width: the minimum, or wider for a long label ("QB HTS", "In 20") so the header fits on one line.
 * A header that wrapped would be taller than the name column's, and every row would sit out of line with its name.
 */
export function columnWidth(label: string): number {
  return Math.max(MIN_COLUMN_WIDTH, label.length * CHAR_WIDTH + PADDING);
}
