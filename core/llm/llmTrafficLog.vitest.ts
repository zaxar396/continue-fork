import { describe, expect, it } from "vitest";
import { llmTrafficLogEnabled } from "./llmTrafficLog";

describe("llmTrafficLogEnabled", () => {
  it("is on only when the shared setting is true", () => {
    expect(llmTrafficLogEnabled(undefined)).toBe(false);
    expect(llmTrafficLogEnabled({})).toBe(false);
    expect(llmTrafficLogEnabled({ logLlmTraffic: false })).toBe(false);
    expect(llmTrafficLogEnabled({ logLlmTraffic: true })).toBe(true);
  });
});
