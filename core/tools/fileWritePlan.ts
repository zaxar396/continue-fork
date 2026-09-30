import { IDE } from "..";
import { throwIfFileIsSecurityConcern } from "../indexing/ignore";
import { ContinueError, ContinueErrorReason } from "../util/errors";
import {
  inferResolvedUriFromRelativePath,
  resolveRelativePathInDir,
} from "../util/ideUtils";
import { getCleanUriPath } from "../util/uri";

export interface PreparedFileEdit {
  creating: false;
  fileUri: string;
  editingFileContents: string;
  newFileContents: string;
  edits: { old_string: string; new_string: string; replace_all?: boolean }[];
}

export interface PreparedFileCreate {
  creating: true;
  fileUri: string;
  newFileContents: string;
}

export const FILE_WRITE_ARGS_REQUIRED =
  "Pass contents to create a file that does not exist, or replacements to change a file that exists.";

export function requireFilepath(filepath: unknown): string {
  if (!filepath || typeof filepath !== "string") {
    throw new ContinueError(
      ContinueErrorReason.FindAndReplaceMissingFilepath,
      "filepath (string) is required",
    );
  }
  return filepath;
}

export function singleFindHasEdits(args: Record<string, unknown>): boolean {
  if (Array.isArray(args.replacements)) {
    return args.replacements.length > 0;
  }
  return "old_string" in args || "new_string" in args;
}

export function multiEditHasEdits(args: Record<string, unknown>): boolean {
  return Array.isArray(args.edits) && args.edits.length > 0;
}

export async function resolveExistingFile(
  filepath: string,
  ide: IDE,
): Promise<string> {
  const resolved = await resolveRelativePathInDir(filepath, ide);
  if (!resolved) {
    throw new ContinueError(
      ContinueErrorReason.FileNotFound,
      `File ${filepath} does not exist. Pass contents to create it.`,
    );
  }
  return resolved;
}

export async function resolveNewFile(
  filepath: string,
  ide: IDE,
): Promise<string> {
  const uri = await inferResolvedUriFromRelativePath(filepath, ide);
  throwIfFileIsSecurityConcern(getCleanUriPath(uri));
  if (await ide.fileExists(uri)) {
    throw new ContinueError(
      ContinueErrorReason.FileAlreadyExists,
      `File ${filepath} already exists. Pass replacements or edits to change it. Do not overwrite it with contents.`,
    );
  }
  return uri;
}
