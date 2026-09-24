import { describe, expect, it } from "vitest";
import {
  collectSchemaViolations,
  formatInvalidArgs,
  INVALID_ARGS,
  invalidToolArgumentsMessage,
  isMalformedStreamError,
  malformedToolCallReason,
  parseToolCallArguments,
  toMalformedResponseError,
} from "./toolCallValidity";

describe("malformedToolCallReason", () => {
  it("rejects a tool call with no id or name", () => {
    expect(malformedToolCallReason({ function: { name: "read_file" } })).toBe(
      "tool call is missing an id",
    );
    expect(
      malformedToolCallReason({ id: "call_1", function: { name: "  " } }),
    ).toBe("tool call is missing a name");
  });

  it("accepts an identifiable tool call", () => {
    expect(
      malformedToolCallReason({
        id: "call_1",
        function: { name: "read_file", arguments: "{" },
      }),
    ).toBeUndefined();
  });
});

describe("invalidToolArgumentsMessage", () => {
  it("allows empty arguments and a JSON object", () => {
    expect(invalidToolArgumentsMessage(undefined)).toBeUndefined();
    expect(invalidToolArgumentsMessage("")).toBeUndefined();
    expect(invalidToolArgumentsMessage('{"filepath":"a.ts"}')).toBeUndefined();
  });

  it("rejects broken JSON and non-objects", () => {
    expect(invalidToolArgumentsMessage("{")).toMatch(/not valid JSON/);
    expect(invalidToolArgumentsMessage("[]")).toBe(
      "arguments must be a JSON object",
    );
  });
});

describe("parseToolCallArguments", () => {
  it("turns empty arguments into an object and keeps a broken string unparsed", () => {
    expect(parseToolCallArguments("")).toEqual({ ok: true, args: {} });
    expect(parseToolCallArguments(undefined)).toEqual({ ok: true, args: {} });

    const broken = parseToolCallArguments('{"filepath":');
    expect(broken.ok).toBe(false);
    if (!broken.ok) {
      expect(broken.violations[0]).toContain("left unchanged");
      expect(broken.violations[0]).toContain('{"filepath":');
      expect(broken.violations[0]).not.toContain("{}");
    }
  });
});

describe("collectSchemaViolations", () => {
  const schema = {
    type: "object",
    required: ["filepath"],
    additionalProperties: false,
    properties: {
      filepath: { type: "string" },
      startLine: { type: "integer" },
    },
  };

  it("lists every violation and does not invent missing values", () => {
    expect(
      collectSchemaViolations({ startLine: "1", extra: true }, schema),
    ).toEqual([
      "`filepath` is required",
      "`startLine` must be of type integer",
      "`extra` is not allowed",
    ]);
    expect(formatInvalidArgs("read_file", ["`filepath` is required"])).toContain(
      INVALID_ARGS,
    );
  });
});

describe("malformed stream errors", () => {
  it("recognizes a broken SSE payload", () => {
    const error = new Error("Malformed JSON sent from server: {");
    expect(isMalformedStreamError(error)).toBe(true);
    expect(toMalformedResponseError(error).message).toBe(
      "MALFORMED_RESPONSE: Malformed JSON sent from server: {",
    );
  });
});
