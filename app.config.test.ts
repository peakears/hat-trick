import { describe, expect, it } from "vitest";
import { androidVersionCode } from "./app.config";

describe("androidVersionCode", () => {
  it("grows with every release", () => {
    expect(androidVersionCode("0.2.0")).toBe(2_000);
    expect(androidVersionCode("1.0.0")).toBe(1_000_000);
    expect(androidVersionCode("1.2.3")).toBe(1_002_003);
    const order = ["0.2.0", "0.2.1", "0.3.0", "1.0.0", "1.0.1", "1.10.0", "2.0.0"].map(androidVersionCode);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("rejects versions it cannot encode", () => {
    expect(() => androidVersionCode("next")).toThrow(/not semver/);
    expect(() => androidVersionCode("1.1000.0")).toThrow(/below 1000/);
  });
});
