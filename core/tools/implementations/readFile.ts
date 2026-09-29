import { resolveInputPath } from "../../util/pathResolver";
import { getUriPathBasename } from "../../util/uri";

import { ContextItem, ToolExtras } from "../..";
import { ToolImpl } from ".";
import { throwIfFileIsSecurityConcern } from "../../indexing/ignore";
import { countTokensAsync } from "../../llm/countTokens";
import { filePathsFromArg } from "../definitions/readFile";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import {
  limitLines,
  optionalLine,
  readWindowNotice,
  sliceFileLines,
} from "./readFileWindow";

async function readOneFile(
  filepath: string,
  extras: ToolExtras,
  startLine?: number,
  endLine?: number,
): Promise<ContextItem> {
  const resolvedPath = await resolveInputPath(extras.ide, filepath);
  if (!resolvedPath) {
    throw new ContinueError(
      ContinueErrorReason.FileNotFound,
      `File "${filepath}" does not exist or is not accessible. You might want to check the path and try again.`,
    );
  }

  throwIfFileIsSecurityConcern(resolvedPath.displayPath);

  const content = await extras.ide.readFile(resolvedPath.uri, true);
  const displayPath = resolvedPath.displayPath;
  const sliced = sliceFileLines(content, startLine, endLine);

  if (sliced.pastEnd || sliced.totalLines === 0) {
    const detail =
      sliced.totalLines === 0
        ? "the file is empty."
        : `start_line ${sliced.startLine} is past the end. The file has ${sliced.totalLines} lines.`;
    return {
      name: getUriPathBasename(resolvedPath.uri),
      description: displayPath,
      content: `[read_file] ${displayPath}: ${detail}`,
      uri: {
        type: "file",
        value: resolvedPath.uri,
      },
    };
  }

  const model = extras.config.selectedModelByRole.chat;
  const tokenLimit = model ? model.contextLength / 2 : undefined;
  const fitted = await limitLines(sliced.lines, tokenLimit, (text) =>
    countTokensAsync(text, model?.title ?? ""),
  );
  const end = sliced.startLine + fitted.lines.length - 1;
  const entireFile = sliced.entireFile && !fitted.truncated;

  return {
    name: getUriPathBasename(resolvedPath.uri),
    description: entireFile
      ? displayPath
      : `${displayPath} (lines ${sliced.startLine}-${end})`,
    content: entireFile
      ? content
      : `${fitted.lines.join("\n")}\n\n${readWindowNotice(
          displayPath,
          sliced.startLine,
          end,
          sliced.totalLines,
          fitted.truncated,
        )}`,
    uri: {
      type: "file",
      value: resolvedPath.uri,
    },
  };
}

export const readFileImpl: ToolImpl = async (args, extras) => {
  const paths = filePathsFromArg(args.filepath);
  if (paths.length === 0) {
    throw new Error(
      "`filepath` argument is required and must not be empty or whitespace-only. Pass a path or an array of paths.",
    );
  }

  const startLine = optionalLine(args, "start_line", "startLine");
  const endLine = optionalLine(args, "end_line", "endLine");
  const items: ContextItem[] = [];
  const errors: string[] = [];
  for (const filepath of paths) {
    try {
      items.push(await readOneFile(filepath, extras, startLine, endLine));
    } catch (error) {
      if (paths.length === 1) {
        throw error;
      }
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (errors.length > 0 && items.length === 0) {
    throw new Error(errors.join("\n"));
  }

  for (const message of errors) {
    items.push({
      name: "Read error",
      description: "Could not read a file",
      content: message,
    });
  }

  return items;
};
