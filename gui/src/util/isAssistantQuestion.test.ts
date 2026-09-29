import { isAssistantQuestion } from "./isAssistantQuestion";

describe("isAssistantQuestion", () => {
  it("marks a direct question", () => {
    expect(
      isAssistantQuestion(
        "Should value be a string or an object in the connector contract?",
      ),
    ).toBe(true);
  });

  it("ignores a question mark inside a code fence", () => {
    expect(
      isAssistantQuestion("The check is:\n```go\nif ok ? a : b\n```"),
    ).toBe(false);
  });

  it("ignores a finished statement", () => {
    expect(isAssistantQuestion("I set value to a string.")).toBe(false);
  });

  it("ignores a question mark inside the model's own deliberation", () => {
    expect(
      isAssistantQuestion(
        "Wait, maybe the current repo is meant to be the connector? Let me check the go.mod module name. The repo is a business service.",
      ),
    ).toBe(false);
  });

  it("marks a reply that ends on a question", () => {
    expect(
      isAssistantQuestion(
        "The open repo is the business service.\n\nWhich repository should contain the connector?",
      ),
    ).toBe(true);
  });
});
