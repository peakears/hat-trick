import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CLAUDE.md is read at the start of every session, so it has to stay short and current.
// See "Keeping this file short" inside it. If this fails, shorten bullets; do not raise the limits.
const MAX_BYTES = 12_000;
const MAX_LINES = 120;

const text = readFileSync(new URL("../CLAUDE.md", import.meta.url), "utf8");

describe("CLAUDE.md", () => {
  it(`stays under ${MAX_BYTES} bytes and ${MAX_LINES} lines`, () => {
    expect(Buffer.byteLength(text, "utf8")).toBeLessThanOrEqual(MAX_BYTES);
    expect(text.split("\n").length).toBeLessThanOrEqual(MAX_LINES);
  });

  it("has no struck-through Done history", () => {
    expect(text).not.toContain("~~");
  });

  it("lists no release version numbers", () => {
    expect(text).not.toMatch(/\bv?\d+\.\d+\.\d+\b/);
  });
});
