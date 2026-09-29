import { ToolPolicy } from "@continuedev/terminal-security";
import { Tool } from "../..";
import {
  ResolvedPath,
  isTrustedFileAccess,
  resolveInputPath,
} from "../../util/pathResolver";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { evaluateFileAccessPolicy } from "../policies/fileAccess";

export function filePathsFromArg(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === "string" && item.trim() !== "",
    );
  }
  return [];
}

export const readFileTool: Tool = {
  type: "function",
  displayTitle: "Read File",
  wouldLikeTo: "read {{{ filepath }}}",
  isCurrently: "reading {{{ filepath }}}",
  hasAlready: "read {{{ filepath }}}",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ReadFile,
    description:
      "Read one or more files whose paths are already known. Call it immediately; do not describe the read first. When several files are known, pass every path in this one call. Optional start_line and end_line are 1-based inclusive bounds for every path in the call. A long file with no range returns the first window and the total line count.",
    parameters: {
      type: "object",
      required: ["filepath"],
      properties: {
        filepath: {
          anyOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
          description:
            "A path, or an array of paths, to read in this one call. Each path can be relative to the workspace root, absolute, a tilde path (~/...), or a file:// URI.",
        },
        start_line: {
          anyOf: [{ type: "integer" }, { type: "string" }, { type: "null" }],
          description:
            "Optional 1-based first line. Applies to every path in this call. Omit to start at line 1.",
        },
        end_line: {
          anyOf: [{ type: "integer" }, { type: "string" }, { type: "null" }],
          description:
            "Optional 1-based last line, inclusive. Applies to every path in this call. Omit to read through the end, or through the first window if the file is too large.",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To read a file with a known filepath, use the ${BuiltInToolNames.ReadFile} tool. For example, to read a file located at 'path/to/file.txt', you would respond with this:`,
    exampleArgs: [["filepath", "path/to/the_file.txt"]],
  },
  defaultToolPolicy: "allowedWithoutPermission",
  toolCallIcon: "DocumentIcon",
  preprocessArgs: async (args, { ide }) => {
    const paths = filePathsFromArg(args.filepath);
    const resolvedPaths = await Promise.all(
      paths.map((filepath) => resolveInputPath(ide, filepath)),
    );

    return {
      resolvedPaths,
    };
  },
  evaluateToolCallPolicy: (
    basePolicy: ToolPolicy,
    _: Record<string, unknown>,
    processedArgs?: Record<string, unknown>,
  ): ToolPolicy => {
    const resolvedPaths = processedArgs?.resolvedPaths as
      | Array<ResolvedPath | null | undefined>
      | undefined;
    if (!resolvedPaths?.length) return basePolicy;

    const trusted = resolvedPaths.every(
      (resolvedPath) => resolvedPath && isTrustedFileAccess(resolvedPath),
    );
    return evaluateFileAccessPolicy(basePolicy, trusted);
  },
};
