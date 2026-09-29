import { Tool } from "../..";
import { validateSingleEdit } from "../../edit/searchAndReplace/findAndReplaceUtils";
import { executeMultiFindAndReplace } from "../../edit/searchAndReplace/performReplace";
import { validateSearchAndReplaceFilepath } from "../../edit/searchAndReplace/validateArgs";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { EditOperation } from "./multiEdit";

export interface SingleFindReplacement {
  old_string: string;
  new_string: string;
}

export interface SingleFindAndReplaceArgs {
  filepath: string;
  replacements: SingleFindReplacement[];
}

export function schemaArgsForSingleFind(
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (Array.isArray(args.replacements)) {
    return args;
  }
  if (!("old_string" in args) && !("new_string" in args)) {
    return args;
  }
  return {
    ...args,
    replacements: [
      {
        old_string: args.old_string,
        new_string: args.new_string,
      },
    ],
  };
}

export function editsFromSingleFindArgs(
  args: Record<string, unknown>,
): EditOperation[] {
  if ("replacements" in args && args.replacements !== undefined) {
    if (!Array.isArray(args.replacements)) {
      throw new ContinueError(
        ContinueErrorReason.MultiEditEditsArrayRequired,
        "replacements must be an array",
      );
    }
    if (args.replacements.length === 0) {
      throw new ContinueError(
        ContinueErrorReason.MultiEditEditsArrayEmpty,
        "replacements must contain at least one edit",
      );
    }
    return args.replacements.map((item, index) => {
      const edit = item as { old_string?: unknown; new_string?: unknown };
      const { oldString, newString } = validateSingleEdit(
        edit?.old_string,
        edit?.new_string,
        undefined,
        index,
      );
      return {
        old_string: oldString,
        new_string: newString,
        replace_all: false,
      };
    });
  }

  if ("old_string" in args || "new_string" in args) {
    const { oldString, newString } = validateSingleEdit(
      args.old_string,
      args.new_string,
      undefined,
    );
    return [
      {
        old_string: oldString,
        new_string: newString,
        replace_all: false,
      },
    ];
  }

  throw new ContinueError(
    ContinueErrorReason.MultiEditEditsArrayRequired,
    "replacements is required",
  );
}

export const singleFindAndReplaceTool: Tool = {
  type: "function",
  displayTitle: "Find and Replace",
  wouldLikeTo: "edit {{{ filepath }}}",
  isCurrently: "editing {{{ filepath }}}",
  hasAlready: "edited {{{ filepath }}}",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  isInstant: false,
  function: {
    name: BuiltInToolNames.SingleFindAndReplace,
    description: `Performs exact string replacements in a file.

IMPORTANT:
- ALWAYS use the \`${BuiltInToolNames.ReadFile}\` tool just before making edits, to understand the file's up-to-date contents and context. The user can also edit the file while you are working with it.
- Pass every replacement already known for this file in the replacements array of this one call. One item is enough. Do not list the replacements in prose first.
- When editing text from \`${BuiltInToolNames.ReadFile}\` tool output, ensure you preserve exact whitespace/indentation.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- Each old_string must match exactly once. If it appears more than once, include more surrounding lines in that same item until it is unique.

WARNINGS:
- The edit will FAIL if an old_string is not unique in the file at the moment that item is applied. Widen it with surrounding context and call again.
- The edit will likely fail if you have not recently used the \`${BuiltInToolNames.ReadFile}\` tool to view up-to-date file contents.`,
    parameters: {
      type: "object",
      required: ["filepath", "replacements"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path to the file to modify, relative to the root of the workspace",
        },
        replacements: {
          type: "array",
          description:
            "Every replacement already known for this file, applied in order. Use one item when there is only one change.",
          items: {
            type: "object",
            required: ["old_string", "new_string"],
            properties: {
              old_string: {
                type: "string",
                description:
                  "The text to replace. It must match exactly once, including whitespace and indentation.",
              },
              new_string: {
                type: "string",
                description:
                  "The text to replace it with. It must differ from old_string.",
              },
            },
          },
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To perform exact string replacements in a file, use the ${BuiltInToolNames.SingleFindAndReplace} tool with a filepath (relative to the root of the workspace) and a replacements array. Put every known replacement for that file in the same call.

  For example, you could respond with:`,
    exampleArgs: [
      ["filepath", "path/to/file.ts"],
      [
        "replacements",
        `[{ "old_string": "const oldVariable = 'value'", "new_string": "const newVariable = 'updated'" }]`,
      ],
    ],
  },
  defaultToolPolicy: "allowedWithoutPermission",
  preprocessArgs: async (args, extras) => {
    const edits = editsFromSingleFindArgs(args);
    const fileUri = await validateSearchAndReplaceFilepath(
      args.filepath,
      extras.ide,
    );

    const editingFileContents = await extras.ide.readFile(fileUri);
    const newFileContents = executeMultiFindAndReplace(
      editingFileContents,
      edits,
      false,
    );

    return {
      ...args,
      edits,
      fileUri,
      editingFileContents,
      newFileContents,
    };
  },
};
