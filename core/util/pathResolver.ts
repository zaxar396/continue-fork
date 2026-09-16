import { fileURLToPath, pathToFileURL } from "node:url";
import * as path from "path";
import untildify from "untildify";
import { IDE } from "..";
import { resolveRelativePathInDir } from "./ideUtils";
import { findUriInDirs } from "./uri";

export interface ResolvedPath {
  uri: string;
  displayPath: string;
  isAbsolute: boolean;
  isWithinWorkspace: boolean;
  isInAllowedDirectory: boolean;
}

const WINDOWS_ABS_PATH = /^[a-zA-Z]:[\\/]/;

function isWindowsPath(fsPath: string): boolean {
  return WINDOWS_ABS_PATH.test(fsPath) || fsPath.startsWith("\\\\");
}

interface PathApi {
  isAbsolute(p: string): boolean;
  normalize(p: string): string;
  resolve(...paths: string[]): string;
  sep: string;
}

function pathApiFor(fsPath: string): PathApi {
  return isWindowsPath(fsPath) || process.platform === "win32"
    ? path.win32
    : path;
}

/**
 * Normalize a user-supplied or resolved filesystem path / file URI for comparison.
 * Relative paths are rejected because their meaning depends on an unknown cwd.
 */
export function normalizeComparableFsPath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  let fsPath: string;
  if (/^file:/i.test(trimmed)) {
    try {
      fsPath = fileURLToPath(trimmed);
    } catch {
      return null;
    }
  } else {
    fsPath = untildify(trimmed);
  }

  const pathApi = pathApiFor(fsPath);
  if (!pathApi.isAbsolute(fsPath) && !isWindowsPath(fsPath)) {
    return null;
  }

  const resolved = pathApi.normalize(pathApi.resolve(fsPath));
  if (isWindowsPath(fsPath) || process.platform === "win32") {
    return resolved.toLowerCase();
  }
  return resolved;
}

/**
 * True when target is the allowed directory itself or a file/folder inside it.
 * `c:\test` matches `c:\test\foo` but not `c:\test2`.
 */
export function isPathInsideDirectory(
  targetPath: string,
  directoryPath: string,
): boolean {
  const target = normalizeComparableFsPath(targetPath);
  const directory = normalizeComparableFsPath(directoryPath);
  if (!target || !directory) {
    return false;
  }

  const pathApi = pathApiFor(target);
  if (target === directory) {
    return true;
  }

  const separator = pathApi.sep;
  const prefix = directory.endsWith(separator)
    ? directory
    : directory + separator;
  return target.startsWith(prefix);
}

export function isPathInsideAnyAllowedDirectory(
  targetPath: string,
  allowedDirectories: string[],
): boolean {
  return allowedDirectories.some((directory) =>
    isPathInsideDirectory(targetPath, directory),
  );
}

async function getAllowedDirectories(ide: IDE): Promise<string[]> {
  try {
    if (typeof ide.getIdeSettings !== "function") {
      return [];
    }
    const settings = await ide.getIdeSettings();
    if (!Array.isArray(settings?.allowedDirectories)) {
      return [];
    }
    return settings.allowedDirectories.filter(
      (directory) => typeof directory === "string" && directory.trim() !== "",
    );
  } catch {
    return [];
  }
}

async function checkIsInAllowedDirectory(
  ide: IDE,
  uri: string,
  displayPath: string,
): Promise<boolean> {
  const allowedDirectories = await getAllowedDirectories(ide);
  if (allowedDirectories.length === 0) {
    return false;
  }
  return (
    isPathInsideAnyAllowedDirectory(displayPath, allowedDirectories) ||
    isPathInsideAnyAllowedDirectory(uri, allowedDirectories)
  );
}

/**
 * Checks if a URI is within any of the workspace directories
 * Also verifies the file actually exists, matching the behavior of resolveRelativePathInDir
 */
async function isUriWithinWorkspace(ide: IDE, uri: string): Promise<boolean> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  const { foundInDir } = findUriInDirs(uri, workspaceDirs);

  // Check both: within workspace path AND file exists
  if (foundInDir !== null) {
    return await ide.fileExists(uri);
  }

  return false;
}

export async function resolveInputPath(
  ide: IDE,
  inputPath: string,
): Promise<ResolvedPath | null> {
  const trimmedPath = inputPath.trim();

  // Handle file:// URIs
  if (trimmedPath.startsWith("file://")) {
    const displayPath = fileURLToPath(trimmedPath);
    const isWithinWorkspace = await isUriWithinWorkspace(ide, trimmedPath);
    return {
      uri: trimmedPath,
      displayPath,
      isAbsolute: true,
      isWithinWorkspace,
      isInAllowedDirectory: await checkIsInAllowedDirectory(
        ide,
        trimmedPath,
        displayPath,
      ),
    };
  }

  // Expand tilde paths (handles ~/ and ~username/)
  const expandedPath = untildify(trimmedPath);

  // Check if it's an absolute path (including Windows paths)
  const isAbsolute =
    path.isAbsolute(expandedPath) ||
    // Windows network paths
    expandedPath.startsWith("\\\\") ||
    // Windows drive letters
    /^[a-zA-Z]:/.test(expandedPath);

  if (isAbsolute) {
    // Convert to file:// URI format
    const uri = pathToFileURL(expandedPath).href;
    const isWithinWorkspace = await isUriWithinWorkspace(ide, uri);
    return {
      uri,
      displayPath: expandedPath,
      isAbsolute: true,
      isWithinWorkspace,
      isInAllowedDirectory: await checkIsInAllowedDirectory(
        ide,
        uri,
        expandedPath,
      ),
    };
  }

  // Handle relative paths...
  const workspaceUri = await resolveRelativePathInDir(expandedPath, ide);
  if (workspaceUri) {
    return {
      uri: workspaceUri,
      displayPath: expandedPath,
      isAbsolute: false,
      isWithinWorkspace: true,
      isInAllowedDirectory: await checkIsInAllowedDirectory(
        ide,
        workspaceUri,
        expandedPath,
      ),
    };
  }

  return null;
}

export function isTrustedFileAccess(resolvedPath: ResolvedPath): boolean {
  return (
    resolvedPath.isWithinWorkspace || resolvedPath.isInAllowedDirectory
  );
}
