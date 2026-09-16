import { describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import * as path from "path";
import {
  isPathInsideAnyAllowedDirectory,
  isPathInsideDirectory,
  isTrustedFileAccess,
  normalizeComparableFsPath,
  resolveInputPath,
} from "./pathResolver";

describe("isPathInsideDirectory", () => {
  it("matches the directory itself and all subdirectories", () => {
    expect(isPathInsideDirectory("C:\\test\\foo.txt", "C:\\test")).toBe(true);
    expect(isPathInsideDirectory("C:\\test\\nested\\a.go", "C:\\test")).toBe(
      true,
    );
    expect(isPathInsideDirectory("C:\\test", "C:\\test")).toBe(true);
    expect(isPathInsideDirectory("C:/test/foo.txt", "C:\\test")).toBe(true);
  });

  it("does not match a sibling path that only shares a prefix", () => {
    expect(isPathInsideDirectory("C:\\test2\\file.txt", "C:\\test")).toBe(
      false,
    );
    expect(isPathInsideDirectory("C:\\testing\\file.txt", "C:\\test")).toBe(
      false,
    );
  });

  it("is case-insensitive for Windows paths", () => {
    expect(isPathInsideDirectory("c:\\Test\\pkg\\mod\\x.go", "C:\\test")).toBe(
      true,
    );
  });

  it("matches POSIX directories and subdirectories", () => {
    expect(
      isPathInsideDirectory("/opt/go/pkg/mod/x.go", "/opt/go/pkg/mod"),
    ).toBe(true);
    expect(isPathInsideDirectory("/opt/go/pkg/mod", "/opt/go/pkg/mod")).toBe(
      true,
    );
    expect(
      isPathInsideDirectory("/opt/go/pkg/mod2/x.go", "/opt/go/pkg/mod"),
    ).toBe(false);
  });

  it("rejects relative allow-list entries", () => {
    expect(normalizeComparableFsPath("relative/path")).toBeNull();
    expect(isPathInsideDirectory("/tmp/file", "relative/path")).toBe(false);
  });

  it("checks any allowed directory in the list", () => {
    const allowed = ["C:\\test", "/opt/go/pkg/mod"];
    expect(
      isPathInsideAnyAllowedDirectory("C:\\test\\lib\\fmt.go", allowed),
    ).toBe(true);
    expect(
      isPathInsideAnyAllowedDirectory("/opt/go/pkg/mod/x.go", allowed),
    ).toBe(true);
    expect(isPathInsideAnyAllowedDirectory("/somewhere/else", allowed)).toBe(
      false,
    );
  });
});

describe("isTrustedFileAccess", () => {
  it("is trusted when inside workspace or an allowed directory", () => {
    expect(
      isTrustedFileAccess({
        uri: "file:///workspace/a.ts",
        displayPath: "a.ts",
        isAbsolute: false,
        isWithinWorkspace: true,
        isInAllowedDirectory: false,
      }),
    ).toBe(true);
    expect(
      isTrustedFileAccess({
        uri: "file:///C:/test/a.ts",
        displayPath: "C:\\test\\a.ts",
        isAbsolute: true,
        isWithinWorkspace: false,
        isInAllowedDirectory: true,
      }),
    ).toBe(true);
    expect(
      isTrustedFileAccess({
        uri: "file:///C:/other/a.ts",
        displayPath: "C:\\other\\a.ts",
        isAbsolute: true,
        isWithinWorkspace: false,
        isInAllowedDirectory: false,
      }),
    ).toBe(false);
  });
});

describe("resolveInputPath allowed directories", () => {
  const allowed = path.resolve("/tmp/allowed-libs");
  const target = path.join(allowed, "subdir", "lib.go");
  const workspaceUri = pathToFileURL(path.resolve("/workspace")).href;

  it("marks outside-workspace files as allowed when they are under the setting", async () => {
    const ide = {
      getWorkspaceDirs: async () => [workspaceUri],
      fileExists: async () => true,
      getIdeSettings: async () => ({
        allowedDirectories: [allowed],
      }),
    };

    const resolved = await resolveInputPath(ide as any, target);
    expect(resolved).not.toBeNull();
    expect(resolved!.isWithinWorkspace).toBe(false);
    expect(resolved!.isInAllowedDirectory).toBe(true);
  });

  it("does not mark outside-workspace files as allowed when the setting is empty", async () => {
    const ide = {
      getWorkspaceDirs: async () => [workspaceUri],
      fileExists: async () => true,
      getIdeSettings: async () => ({
        allowedDirectories: [],
      }),
    };

    const resolved = await resolveInputPath(ide as any, target);
    expect(resolved).not.toBeNull();
    expect(resolved!.isWithinWorkspace).toBe(false);
    expect(resolved!.isInAllowedDirectory).toBe(false);
  });
});
