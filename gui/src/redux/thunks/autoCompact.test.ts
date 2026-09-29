import { compactionIndex } from "./autoCompact";

function item(role: string, content = "x") {
  return {
    message: { role, content },
    contextItems: [],
  } as any;
}

describe("compactionIndex", () => {
  it("marks the message before the current user turn", () => {
    const history = [
      item("user", "task"),
      item("assistant", "did the previous step"),
      item("user", "Continue the work and answer in the user's language."),
      item("assistant", ""),
    ];

    expect(compactionIndex(history)).toBe(1);
  });

  it("does not mark the only user message", () => {
    const history = [item("user", "task"), item("assistant", "")];

    expect(compactionIndex(history)).toBe(-1);
  });
});
