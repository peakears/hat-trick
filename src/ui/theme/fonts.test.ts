import { describe, expect, it } from "vitest";
import { FONT_FAMILIES, scoreFont, scoreFontSemiBold } from "./fonts";

describe("fonts", () => {
  it("draws scores in the bundled family, tabular, with no weight that could fake a bold", () => {
    for (const style of [scoreFont, scoreFontSemiBold]) {
      expect(Object.values(FONT_FAMILIES)).toContain(style.fontFamily);
      expect(style.fontVariant).toEqual(["tabular-nums"]);
      expect(style).not.toHaveProperty("fontWeight");
    }
  });
});
