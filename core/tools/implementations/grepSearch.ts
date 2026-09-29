import { ToolImpl } from ".";
import { ContextItem } from "../..";
import { throwIfFileIsSecurityConcern } from "../../indexing/ignore";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { formatGrepSearchResults } from "../../util/grepSearch";
import { resolveInputPath } from "../../util/pathResolver";
import { prepareQueryForRipgrep } from "../../util/regexValidator";
import { getStringArg } from "../parseArgs";
import { searchFileText } from "./searchFileText";

const DEFAULT_GREP_SEARCH_RESULTS_LIMIT = 100;
const DEFAULT_GREP_SEARCH_CHAR_LIMIT = 7500; // ~1500 tokens, will keep truncation simply for now

function splitGrepResultsByFile(content: string): ContextItem[] {
  const matches = [...content.matchAll(/^\.\/([^\n]+)$/gm)];

  const contextItems: ContextItem[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const filepath = match[1];
    const startIndex = match.index!;
    const endIndex =
      i < matches.length - 1 ? matches[i + 1].index! : content.length;

    // Extract grepped content for this file
    const fileContent = content
      .substring(startIndex, endIndex)
      .replace(/^\.\/[^\n]+\n/, "") // remove the line with file path
      .trim();

    if (fileContent) {
      contextItems.push({
        name: `Search results in ${filepath}`,
        description: `Grep search results from ${filepath}`,
        content: fileContent,
        uri: { type: "file", value: filepath },
      });
    }
  }

  return contextItems;
}

async function searchOneFile(
  filePath: string,
  rawQuery: string,
  extras: Parameters<ToolImpl>[1],
): Promise<ContextItem[]> {
  const resolvedPath = await resolveInputPath(extras.ide, filePath);
  if (!resolvedPath) {
    throw new ContinueError(
      ContinueErrorReason.FileNotFound,
      `File "${filePath}" does not exist or is not accessible. Check the path and try again, or omit path to search the workspace.`,
    );
  }

  throwIfFileIsSecurityConcern(resolvedPath.displayPath);

  let content: string;
  try {
    content = await extras.ide.readFile(resolvedPath.uri, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ContinueError(
      ContinueErrorReason.FileNotFound,
      `Could not read "${resolvedPath.displayPath}" to search it. path must be a file. ${message}`,
    );
  }

  const { query, warning: preparedWarning } = prepareQueryForRipgrep(rawQuery);
  const found = searchFileText(
    content,
    query,
    resolvedPath.displayPath,
    DEFAULT_GREP_SEARCH_RESULTS_LIMIT,
  );
  const warning = [preparedWarning, found.warning].filter(Boolean).join(" ");

  if (found.matches === 0) {
    const hint = warning ? `\n${warning}` : "";
    return [
      {
        name: "Search results",
        description: `Grep search results from ${resolvedPath.displayPath}`,
        content: `The search returned no results in ${resolvedPath.displayPath} (${found.totalLines} lines). Try a shorter literal, or call read_file with start_line and end_line.${hint}`,
      },
    ];
  }

  let body = found.body;
  const notes: string[] = [];
  if (warning) {
    notes.push(warning);
  }
  if (body.length > DEFAULT_GREP_SEARCH_CHAR_LIMIT) {
    body = body.slice(0, DEFAULT_GREP_SEARCH_CHAR_LIMIT);
    notes.push(
      `Results were truncated because the number of characters exceeded ${DEFAULT_GREP_SEARCH_CHAR_LIMIT}. Narrow the query.`,
    );
  }
  if (found.matches === DEFAULT_GREP_SEARCH_RESULTS_LIMIT) {
    notes.push(
      `Results were truncated because the number of results exceeded ${DEFAULT_GREP_SEARCH_RESULTS_LIMIT}.`,
    );
  }
  notes.push(
    "Line numbers are 1-based. Call read_file with this filepath and start_line/end_line to read the section.",
  );

  return [
    {
      name: "Search results",
      description: `Grep search results from ${resolvedPath.displayPath}`,
      content: `${body}\n${notes.join("\n")}`,
      uri: { type: "file", value: resolvedPath.uri },
    },
  ];
}

export const grepSearchImpl: ToolImpl = async (args, extras) => {
  const rawQuery = getStringArg(args, "query");
  const filePath = typeof args.path === "string" ? args.path.trim() : "";
  if (filePath) {
    return searchOneFile(filePath, rawQuery, extras);
  }

  const { query, warning } = prepareQueryForRipgrep(rawQuery);

  let results: string;
  try {
    results = await extras.ide.getSearchResults(
      query,
      DEFAULT_GREP_SEARCH_RESULTS_LIMIT,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Helpful error for common ripgrep exit code
    if (errorMessage.includes("Process exited with code 2")) {
      return [
        {
          name: "Search error",
          description: "The search query could not be processed",
          content: `The search failed due to an invalid regex pattern.\n\nOriginal query: ${rawQuery}\nProcessed query: ${query}\n\nError: ${errorMessage}\n\nTip: If you're searching for literal text with special characters, the query was automatically escaped. If you need regex patterns, ensure they use proper regex syntax.`,
        },
      ];
    }

    throw new ContinueError(
      ContinueErrorReason.SearchExecutionFailed,
      errorMessage,
    );
  }

  const { formatted, numResults, truncated } = formatGrepSearchResults(
    results,
    DEFAULT_GREP_SEARCH_CHAR_LIMIT,
  );

  if (numResults === 0) {
    return [
      {
        name: "Search results",
        description: "Results from grep search",
        content: "The search returned no results.",
      },
    ];
  }

  const truncationReasons: string[] = [];
  if (numResults === DEFAULT_GREP_SEARCH_RESULTS_LIMIT) {
    truncationReasons.push(
      `the number of results exceeded ${DEFAULT_GREP_SEARCH_RESULTS_LIMIT}`,
    );
  }
  if (truncated) {
    truncationReasons.push(
      `the number of characters exceeded ${DEFAULT_GREP_SEARCH_CHAR_LIMIT}`,
    );
  }

  let contextItems: ContextItem[];

  const splitByFile: boolean = args?.splitByFile || false;
  if (splitByFile) {
    contextItems = splitGrepResultsByFile(formatted);
  } else {
    contextItems = [
      {
        name: "Search results",
        description: "Results from grep search",
        content: formatted,
      },
    ];
  }

  // Add warnings about query modifications or truncation
  const warnings: string[] = [];
  if (warning) {
    warnings.push(warning);
  }
  if (truncationReasons.length > 0) {
    warnings.push(
      `Results were truncated because ${truncationReasons.join(" and ")}`,
    );
  }

  if (truncationReasons.length > 0) {
    contextItems.push({
      name: "Truncation warning",
      description: "",
      content: `The above search results were truncated because ${truncationReasons.join(" and ")}. If the results are not satisfactory, try refining your search query.`,
    });
  }
  return contextItems;
};
