import { describe, expect, it } from "vitest";
import { searchFileText } from "./searchFileText";

const doc = [
  "вступление",
  "контекст",
  "Раздел FR3. Требования",
  "подробности",
  "конец",
].join("\n");

describe("searchFileText", () => {
  it("finds a Cyrillic heading and reports a 1-based line number", () => {
    const found = searchFileText(doc, "FR3", "docs/аналитика.md");
    expect(found.matches).toBe(1);
    expect(found.body).toContain("./docs/аналитика.md");
    expect(found.body).toContain("3:Раздел FR3. Требования");
    expect(found.body).toContain("2-контекст");
    expect(found.body).toContain("4-подробности");
  });

  it("matches Cyrillic case-insensitively", () => {
    const found = searchFileText(doc, "раздел", "аналитика.md");
    expect(found.matches).toBe(1);
    expect(found.body).toContain("3:Раздел FR3. Требования");
  });

  it("searches an invalid regex as literal text", () => {
    const found = searchFileText("см. (FR3", "(FR3", "аналитика.md");
    expect(found.warning).toContain("literal");
    expect(found.matches).toBe(1);
    expect(found.body).toContain("1:см. (FR3");
  });

  it("says how many lines were searched when nothing matches", () => {
    const found = searchFileText(doc, "нет такого", "аналитика.md");
    expect(found.matches).toBe(0);
    expect(found.totalLines).toBe(5);
    expect(found.body).toBe("");
  });
});
