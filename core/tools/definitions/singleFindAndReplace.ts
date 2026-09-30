import { IDE, Tool } from "../..";
import { validateSingleEdit } from "../../edit/searchAndReplace/findAndReplaceUtils";
import { executeMultiFindAndReplace } from "../../edit/searchAndReplace/performReplace";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import {
  FILE_WRITE_ARGS_REQUIRED,
  PreparedFileCreate,
  PreparedFileEdit,
  requireFilepath,
  resolveExistingFile,
  resolveNewFile,
  singleFindHasEdits,
} from "../fileWritePlan";
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
    FILE_WRITE_ARGS_REQUIRED,
  );
}

export async function prepareSingleFind(
  args: Record<string, unknown>,
  ide: IDE,
): Promise<PreparedFileEdit | PreparedFileCreate> {
  const filepath = requireFilepath(args.filepath);
  if (!singleFindHasEdits(args)) {
    if (typeof args.contents !== "string") {
      throw new ContinueError(
        ContinueErrorReason.MultiEditEditsArrayRequired,
        FILE_WRITE_ARGS_REQUIRED,
      );
    }
    return {
      creating: true,
      fileUri: await resolveNewFile(filepath, ide),
      newFileContents: args.contents,
    };
  }

  const edits = editsFromSingleFindArgs(args);
  const fileUri = await resolveExistingFile(filepath, ide);
  const editingFileContents = await ide.readFile(fileUri);
  return {
    creating: false,
    fileUri,
    editingFileContents,
    newFileContents: executeMultiFindAndReplace(
      editingFileContents,
      edits,
      false,
    ),
    edits,
  };
}

export const singleFindAndReplaceTool: Tool = {
  type: "function",
  displayTitle: "Find and Replace",
  wouldLikeTo: "write {{{ filepath }}}",
  isCurrently: "writing {{{ filepath }}}",
  hasAlready: "wrote {{{ filepath }}}",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  isInstant: false,
  function: {
    name: BuiltInToolNames.SingleFindAndReplace,
    description: `Create a file that does not exist, or replace exact text in a file that exists.

To create a missing file, pass filepath and contents. Do not pass replacements.
To change an existing file, pass filepath and replacements. Read the file first. Do not pass contents.
If the file already exists, contents is rejected. If it does not exist, replacements are rejected.
Do not print the file in the reply. The file text belongs only in this call.

IMPORTANT:
- Pass every replacement already known for this file in the replacements array of this one call. One item is enough. Do not list the replacements in prose first.
- When editing text from \`${BuiltInToolNames.ReadFile}\` tool output, ensure you preserve exact whitespace/indentation.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- Each old_string must match exactly once. If it appears more than once, include more surrounding lines in that same item until it is unique.

WARNINGS:
- The edit will FAIL if an old_string is not unique in the file at the moment that item is applied. Widen it with surrounding context and call again.
- The edit will likely fail if you have not recently used the \`${BuiltInToolNames.ReadFile}\` tool to view up-to-date file contents.`,
    parameters: {
      type: "object",
      required: ["filepath"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path of the file to create or change, relative to the root of the workspace",
        },
        contents: {
          anyOf: [{ type: "string" }, { type: "null" }],
          description:
            "Full text of a new file. Use this only when the file does not exist. Omit it when passing replacements.",
        },
        replacements: {
          anyOf: [
            {
              type: "array",
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
            { type: "null" },
          ],
          description:
            "Every replacement already known for an existing file, applied in order. Use one item when there is only one change. Omit this when creating a file with contents.",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To create a missing file or change an existing one, use the ${BuiltInToolNames.SingleFindAndReplace} tool. Pass contents when the file does not exist. Pass a replacements array when it does.

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
    const prepared = await prepareSingleFind(args, extras.ide);
    return {
      ...args,
      ...prepared,
    };
  },
};
