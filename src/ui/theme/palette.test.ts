import { describe, expect, it } from "vitest";
import {
  ACCENTS,
  colorsFor,
  contrastRatio,
  leagueTint,
  schemeFor,
  TINTED_LEAGUES,
  type Colors,
  type Scheme,
} from "./palette";

const SCHEMES: Scheme[] = ["light", "dark", "black"];
const AA_TEXT = 4.5;

// Every pair of colours the app draws text in, on what. Text sits on cards and on the page background.
const TEXT_PAIRS: [keyof Colors, keyof Colors][] = [
  ["text", "background"],
  ["text", "card"],
  ["muted", "background"],
  ["muted", "card"],
  ["accent", "background"],
  ["accent", "card"],
  ["live", "background"],
  ["live", "card"],
  ["bannerText", "banner"],
  ["onAccent", "accent"],
  ["text", "surfaceSunken"],
  ["muted", "surfaceSunken"],
  ["text", "badge"],
  ["chipSelectedText", "chipSelected"],
  ["win", "background"],
  ["win", "card"],
];

describe("palette contrast (WCAG AA)", () => {
  for (const scheme of SCHEMES) {
    for (const accent of ACCENTS) {
      it(`${scheme} with ${accent}: every text colour reads on its background`, () => {
        const colors = colorsFor(scheme, accent);
        for (const [fg, bg] of TEXT_PAIRS) {
          const ratio = contrastRatio(colors[fg], colors[bg]);
          expect(ratio, `${fg} ${colors[fg]} on ${bg} ${colors[bg]}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
            AA_TEXT,
          );
        }
      });
    }

    it(`${scheme}: cards stand out from the page, and outlines from cards`, () => {
      const colors = colorsFor(scheme, "blue");
      expect(colors.card).not.toBe(colors.background);
      expect(contrastRatio(colors.cardBorder, colors.card)).toBeGreaterThan(contrastRatio(colors.border, colors.card));
    });
  }

  for (const scheme of SCHEMES) {
    it(`${scheme}: every league colour reads on the page, cards and sunken panels`, () => {
      const colors = colorsFor(scheme, "blue");
      for (const league of TINTED_LEAGUES) {
        const tint = leagueTint(league, scheme);
        for (const bg of ["background", "card", "surfaceSunken"] as const) {
          const ratio = contrastRatio(tint, colors[bg]);
          expect(ratio, `${league} ${tint} on ${bg}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_TEXT);
        }
      }
    });
  }

  it("gives a league without a colour of its own the muted text colour", () => {
    expect(leagueTint("mlb", "dark")).toBe(colorsFor("dark", "blue").muted);
  });

  it("gives each league its own colour in every scheme", () => {
    for (const scheme of SCHEMES) {
      const tints = TINTED_LEAGUES.map((l) => leagueTint(l, scheme));
      expect(new Set(tints).size).toBe(tints.length);
    }
  });

  // Marks that are not text (dots, bars, a selected chip's edge, the selected tab's icon) need 3:1 (WCAG 1.4.11).
  for (const scheme of SCHEMES) {
    for (const accent of ACCENTS) {
      it(`${scheme} with ${accent}: dots, bars, chips and the selected tab stand out`, () => {
        const c = colorsFor(scheme, accent);
        const pairs: [string, string, string][] = [
          ["accent on card (team stat bars)", c.accent, c.card],
          ["selected tab icon on its pill", c.accent, c.tabSelected],
          ["live dot on a selected chip", c.chipSelectedLive, c.chipSelected],
          ["live dot on a chip", c.live, c.surfaceSunken],
          ["selected chip on the bar", c.chipSelected, c.card],
          ...TINTED_LEAGUES.map((l): [string, string, string] => [
            `${l} bar on its track`,
            leagueTint(l, scheme),
            c.border,
          ]),
        ];
        for (const [what, fg, bg] of pairs) {
          expect(contrastRatio(fg, bg), `${what}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
        }
      });
    }

    it(`${scheme}: sunken panels and the selected tab's pill differ from the card`, () => {
      const c = colorsFor(scheme, "blue");
      expect(contrastRatio(c.surfaceSunken, c.card)).toBeGreaterThanOrEqual(1.15);
      expect(c.tabSelected).not.toBe(c.card);
    });
  }

  it("uses every colour as #rrggbb", () => {
    for (const scheme of SCHEMES) {
      for (const accent of ACCENTS) {
        for (const value of Object.values(colorsFor(scheme, accent))) expect(value).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe("schemes", () => {
  it("turns dark into pure black only when the setting is on", () => {
    expect(schemeFor(false, false)).toBe("light");
    expect(schemeFor(false, true)).toBe("light");
    expect(schemeFor(true, false)).toBe("dark");
    expect(schemeFor(true, true)).toBe("black");
  });

  it("returns the same object for the same palette", () => {
    expect(colorsFor("dark", "teal")).toBe(colorsFor("dark", "teal"));
    expect(colorsFor("dark", "teal")).not.toBe(colorsFor("black", "teal"));
  });

  it("makes pure black's page black", () => {
    expect(colorsFor("black", "blue").background).toBe("#000000");
  });

  it("keeps today's blue as the default look", () => {
    expect(colorsFor("light", "blue").accent).toBe("#2563eb");
    expect(colorsFor("dark", "blue").accent).toBe("#60a5fa");
  });

  it("computes contrast like WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
    expect(() => contrastRatio("blue", "#ffffff")).toThrow();
  });
});
