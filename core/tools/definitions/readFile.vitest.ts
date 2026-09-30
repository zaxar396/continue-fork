import { describe, expect, it } from "vitest";
import { filePathsFromArg } from "./readFile";
import {
  limitLines,
  optionalLine,
  readWindowNotice,
  sliceFileLines,
} from "../implementations/readFileWindow";

describe("filePathsFromArg", () => {
  it("keeps a single path", () => {
    expect(filePathsFromArg("a.go")).toEqual(["a.go"]);
  });

  it("keeps every path from one call", () => {
    expect(filePathsFromArg(["a.go", "b.go"])).toEqual(["a.go", "b.go"]);
  });

  it("drops empty entries", () => {
    expect(filePathsFromArg(["a.go", "  ", 1])).toEqual(["a.go"]);
  });
});

describe("read file line window", () => {
  const doc = ["альфа", "Раздел FR3", "бета", "гамма"].join("\n");

  it("reads an inclusive 1-based range and accepts string line numbers", () => {
    const start = optionalLine({ start_line: "2" }, "start_line", "startLine");
    const end = optionalLine({ endLine: 3 }, "start_line", "end_line", "endLine");
    const sliced = sliceFileLines(doc, start, end);
    expect(sliced.lines).toEqual(["Раздел FR3", "бета"]);
    expect(sliced.startLine).toBe(2);
    expect(sliced.endLine).toBe(3);
    expect(sliced.totalLines).toBe(4);
    expect(sliced.entireFile).toBe(false);
  });

  it("keeps the whole file when no range is given", () => {
    const sliced = sliceFileLines(doc);
    expect(sliced.entireFile).toBe(true);
    expect(sliced.lines).toHaveLength(4);
  });

  it("reports a start line past the end", () => {
    const sliced = sliceFileLines(doc, 9);
    expect(sliced.pastEnd).toBe(true);
    expect(sliced.totalLines).toBe(4);
  });

  it("returns a prefix when the file is over the token limit", async () => {
    const lines = Array.from({ length: 20 }, (_, index) => `line-${index}`);
    const fitted = await limitLines(lines, 30, async (text) => text.length);
    expect(fitted.truncated).toBe(true);
    expect(fitted.lines.length).toBeGreaterThan(0);
    expect(fitted.lines.length).toBeLessThan(lines.length);
    expect(fitted.lines.join("\n").length).toBeLessThanOrEqual(30);
  });

  it("names the next read_file call with exact line numbers", () => {
    const notice = readWindowNotice("api/swagger.yaml", 1, 400, 1000, true);
    expect(notice).toContain("600 more lines follow");
    expect(notice).toContain(
      'filepath "api/swagger.yaml", start_line 401, end_line 800',
    );
    expect(notice).toContain('grep_search with path "api/swagger.yaml"');
  });

  it("clips the next window at the end of the file", () => {
    const notice = readWindowNotice("api/swagger.yaml", 401, 800, 1000, true);
    expect(notice).toContain("start_line 801, end_line 1000");
  });

  it("does not offer a next window when the range is complete", () => {
    expect(readWindowNotice("a.yaml", 1, 40, 40, false)).toBe(
      "[read_file] a.yaml: lines 1-40 of 40.",
    );
  });
});
