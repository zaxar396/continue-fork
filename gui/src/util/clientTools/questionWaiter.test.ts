import { describe, expect, it } from "vitest";
import {
  QuestionCancelled,
  submitQuestionAnswer,
  waitForQuestionAnswer,
} from "./questionWaiter";

describe("questionWaiter", () => {
  it("resolves with the submitted answer", async () => {
    const controller = new AbortController();
    const pending = waitForQuestionAnswer("call-1", controller.signal);
    expect(submitQuestionAnswer("call-1", "slog")).toBe(true);
    await expect(pending).resolves.toBe("slog");
    expect(submitQuestionAnswer("call-1", "again")).toBe(false);
  });

  it("rejects when the stream is aborted", async () => {
    const controller = new AbortController();
    const pending = waitForQuestionAnswer("call-2", controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(QuestionCancelled);
    expect(submitQuestionAnswer("call-2", "late")).toBe(false);
  });
});
