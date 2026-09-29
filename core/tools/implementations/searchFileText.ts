import { escapeLiteralForRegex } from "../../util/regexValidator";

const CONTEXT_LINES = 2;

export type FileSearchResult = {
  body: string;
  matches: number;
  totalLines: number;
  warning?: string;
};

function compileQuery(query: string): { pattern: RegExp; warning?: string } {
  try {
    return { pattern: new RegExp(query, "giu") };
  } catch {
    return {
      pattern: new RegExp(escapeLiteralForRegex(query), "giu"),
      warning:
        "The query was not valid regex, so it was searched as literal text.",
    };
  }
}

export function searchFileText(
  content: string,
  query: string,
  displayPath: string,
  maxResults = 100,
): FileSearchResult {
  const lines = content === "" ? [] : content.split(/\r?\n/);
  const { pattern, warning } = compileQuery(query);
  const hits: number[] = [];

  for (let i = 0; i < lines.length && hits.length < maxResults; i++) {
    pattern.lastIndex = 0;
    if (pattern.test(lines[i])) {
      hits.push(i);
    }
  }

  if (hits.length === 0) {
    return { body: "", matches: 0, totalLines: lines.length, warning };
  }

  const blocks: Array<{ start: number; end: number }> = [];
  for (const hit of hits) {
    const start = Math.max(0, hit - CONTEXT_LINES);
    const end = Math.min(lines.length - 1, hit + CONTEXT_LINES);
    const previous = blocks[blocks.length - 1];
    if (previous && start <= previous.end + 1) {
      previous.end = Math.max(previous.end, end);
    } else {
      blocks.push({ start, end });
    }
  }

  const hitSet = new Set(hits);
  const heading = `./${displayPath.replace(/\\/g, "/").replace(/^\.\//, "")}`;
  const out: string[] = [heading];
  blocks.forEach((block, index) => {
    if (index > 0) {
      out.push("--");
    }
    for (let i = block.start; i <= block.end; i++) {
      const separator = hitSet.has(i) ? ":" : "-";
      out.push(`${i + 1}${separator}${lines[i]}`);
    }
  });

  return {
    body: out.join("\n"),
    matches: hits.length,
    totalLines: lines.length,
    warning,
  };
}
