/**
 * The app's colours: a base palette per scheme (light, dark, pure black) plus the accent the user
 * picked. Pure (no React Native imports), so the contrast of every combination is unit tested
 * against WCAG AA in palette.test.ts. Change a colour here, never in a screen.
 */

export interface Colors {
  background: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  /** Outline of a standalone card (a game on the Scores tab); stronger than row dividers. */
  cardBorder: string;
  /** Links, buttons, the selected tab, highlights. Also used as text, so it must read on cards and the background. */
  accent: string;
  /** Text and icons drawn on an `accent` fill (a filled button). */
  onAccent: string;
  live: string;
  banner: string;
  bannerText: string;
  /** A panel set into a card or the page (points by period, a segmented control's track): `text` and `muted` read on it. */
  surfaceSunken: string;
  /** The circle behind a team's or player's abbreviation when there is no logo or photo; `text` reads on it. */
  badge: string;
  /** A selected chip (the league row): a fill in the text colour, with `chipSelectedText` on it. */
  chipSelected: string;
  chipSelectedText: string;
  /** The live dot on a selected chip, which sits on `chipSelected` rather than a card. */
  chipSelectedLive: string;
  /** The pill behind the selected tab's icon: a soft wash of the accent over the card, with the icon in `accent`. */
  tabSelected: string;
  /** Good news in text: a win streak. */
  win: string;
}

export type Scheme = "light" | "dark" | "black";

type Base = Omit<Colors, "accent" | "onAccent" | "tabSelected">;

const BASES: Record<Scheme, Base> = {
  light: {
    background: "#f2f3f5",
    card: "#ffffff",
    text: "#14171a",
    muted: "#656c79",
    border: "#e2e4e8",
    cardBorder: "#d1d5db",
    live: "#c81e1e",
    banner: "#fef3c7",
    bannerText: "#78350f",
    surfaceSunken: "#eceef1",
    badge: "#e3e6ea",
    chipSelected: "#14171a",
    chipSelectedText: "#ffffff",
    chipSelectedLive: "#f87171",
    win: "#15803d",
  },
  dark: {
    background: "#0e0f11",
    card: "#1e2126",
    text: "#f2f3f5",
    muted: "#9ca3af",
    border: "#363b44",
    cardBorder: "#4b5260",
    live: "#f87171",
    banner: "#3b2f12",
    bannerText: "#fde68a",
    surfaceSunken: "#111316",
    badge: "#2b3038",
    chipSelected: "#f2f3f5",
    chipSelectedText: "#0e0f11",
    chipSelectedLive: "#c81e1e",
    win: "#4ade80",
  },
  // Pure black for OLED screens: the page is #000 (those pixels are off), cards are a hair lighter
  // so they still read as cards.
  black: {
    background: "#000000",
    card: "#121316",
    text: "#f2f3f5",
    muted: "#9ca3af",
    border: "#2a2d33",
    cardBorder: "#3a3e46",
    live: "#f87171",
    banner: "#2a210c",
    bannerText: "#fde68a",
    // Lighter than the card: on pure black, a darker panel would all but vanish.
    surfaceSunken: "#22252b",
    badge: "#22252b",
    chipSelected: "#f2f3f5",
    chipSelectedText: "#000000",
    chipSelectedLive: "#c81e1e",
    win: "#4ade80",
  },
};

export const ACCENTS = ["blue", "teal", "green", "orange", "purple", "pink"] as const;
export type AccentId = (typeof ACCENTS)[number];

/** Each accent has a darker shade for light backgrounds and a lighter one for dark and black. */
const ACCENT_SHADES: Record<AccentId, { light: string; dark: string }> = {
  blue: { light: "#2563eb", dark: "#60a5fa" }, // the app icon's colour
  teal: { light: "#0f766e", dark: "#2dd4bf" },
  green: { light: "#15803d", dark: "#4ade80" },
  orange: { light: "#c2410c", dark: "#fb923c" },
  purple: { light: "#7c3aed", dark: "#a78bfa" },
  pink: { light: "#be185d", dark: "#f472b6" },
};

export const ACCENT_LABELS: Record<AccentId, string> = {
  blue: "Blue",
  teal: "Teal",
  green: "Green",
  orange: "Orange",
  purple: "Purple",
  pink: "Pink",
};

/** Which palette to use: dark becomes black when the "Pure black" setting is on. */
export function schemeFor(dark: boolean, pureBlack: boolean): Scheme {
  if (!dark) return "light";
  return pureBlack ? "black" : "dark";
}

/** How much of the accent the selected tab's pill takes, over the card. */
const TAB_WASH = 0.16;

/** `top` laid over `bottom` at `amount` (0-1), as "#rrggbb". */
function mix(top: string, bottom: string, amount: number): string {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [a, b] = [rgb(top), rgb(bottom)];
  return `#${a
    .map((v, i) =>
      Math.round(v * amount + b[i] * (1 - amount))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const cache = new Map<string, Colors>();

/** The full palette. The same object for the same scheme and accent, so it is safe in hook dependencies. */
export function colorsFor(scheme: Scheme, accent: AccentId): Colors {
  const key = `${scheme}:${accent}`;
  let colors = cache.get(key);
  if (!colors) {
    const base = BASES[scheme];
    const shade = ACCENT_SHADES[accent][scheme === "light" ? "light" : "dark"];
    // Light accents are dark shades, so white reads on them; dark-theme accents are light shades, so the background does.
    colors = {
      ...base,
      accent: shade,
      onAccent: scheme === "light" ? "#ffffff" : base.background,
      tabSelected: mix(shade, base.card, TAB_WASH),
    };
    cache.set(key, colors);
  }
  return colors;
}

// ---------- League colours ----------

/**
 * Each league's own colour, used only for small marks that say which league something is: its name over a list of
 * games, the bars on its leader boards, its standings bands. Never a fill under text. A new league adds a pair
 * here (palette.test.ts checks it reads on cards, the page and sunken panels); a league without one uses `muted`.
 */
const LEAGUE_TINTS: Record<string, { light: string; dark: string }> = {
  nhl: { light: "#0369a1", dark: "#7dd3fc" },
  nba: { light: "#b93d0b", dark: "#fb923c" },
};

/** The leagues that have their own colour. */
export const TINTED_LEAGUES = Object.keys(LEAGUE_TINTS);

/** The colour that marks `league` in `scheme`. */
export function leagueTint(league: string, scheme: Scheme): string {
  const tint = LEAGUE_TINTS[league];
  if (!tint) return BASES[scheme].muted;
  return tint[scheme === "light" ? "light" : "dark"];
}

/** The accent's swatch for the picker: the shade the current scheme uses. */
export function accentSwatch(accent: AccentId, scheme: Scheme): string {
  return ACCENT_SHADES[accent][scheme === "light" ? "light" : "dark"];
}

// ---------- Contrast (WCAG 2.x) ----------

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a "#rrggbb" colour, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const [r, g, b] = m.slice(1).map((h) => channel(parseInt(h, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio of two colours, 1 to 21. WCAG AA asks 4.5 for normal text, 3 for large text and icons. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
