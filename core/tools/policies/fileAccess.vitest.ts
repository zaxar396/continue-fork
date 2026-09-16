import { describe, expect, it } from "vitest";
import { readFileTool } from "../definitions/readFile";
import { evaluateFileAccessPolicy } from "./fileAccess";

describe("evaluateFileAccessPolicy", () => {
  it("keeps disabled tools disabled", () => {
    expect(evaluateFileAccessPolicy("disabled", true)).toBe("disabled");
    expect(evaluateFileAccessPolicy("disabled", false)).toBe("disabled");
  });

  it("uses the base policy for trusted locations", () => {
    expect(
      evaluateFileAccessPolicy("allowedWithoutPermission", true),
    ).toBe("allowedWithoutPermission");
    expect(evaluateFileAccessPolicy("allowedWithPermission", true)).toBe(
      "allowedWithPermission",
    );
  });

  it("requires permission for untrusted locations", () => {
    expect(
      evaluateFileAccessPolicy("allowedWithoutPermission", false),
    ).toBe("allowedWithPermission");
  });
});

describe("readFileTool.evaluateToolCallPolicy", () => {
  it("auto-runs files in an allowed directory even when they are outside the workspace", () => {
    const policy = readFileTool.evaluateToolCallPolicy!(
      "allowedWithoutPermission",
      {},
      {
        resolvedPath: {
          uri: "file:///C:/test/lib.go",
          displayPath: "C:\\test\\lib.go",
          isAbsolute: true,
          isWithinWorkspace: false,
          isInAllowedDirectory: true,
        },
      },
    );
    expect(policy).toBe("allowedWithoutPermission");
  });

  it("requires permission for files outside workspace and the allow-list", () => {
    const policy = readFileTool.evaluateToolCallPolicy!(
      "allowedWithoutPermission",
      {},
      {
        resolvedPath: {
          uri: "file:///C:/other/lib.go",
          displayPath: "C:\\other\\lib.go",
          isAbsolute: true,
          isWithinWorkspace: false,
          isInAllowedDirectory: false,
        },
      },
    );
    expect(policy).toBe("allowedWithPermission");
  });
});
