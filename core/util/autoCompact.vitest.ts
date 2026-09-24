import { describe, expect, it } from "vitest";
import { shouldAutoCompactContext } from "./autoCompact";

describe("shouldAutoCompactContext", () => {
  it("compacts at the CLI 80% ratio", () => {
    expect(shouldAutoCompactContext({ contextPercentage: 0.8 })).toBe(true);
    expect(shouldAutoCompactContext({ contextPercentage: 0.79 })).toBe(false);
  });

  it("compacts when history was already pruned or cannot fit", () => {
    expect(shouldAutoCompactContext({ didPrune: true, contextPercentage: 0.1 })).toBe(
      true,
    );
    expect(shouldAutoCompactContext({ notEnoughContext: true })).toBe(true);
  });
});
