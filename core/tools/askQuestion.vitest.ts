import { expect, test } from "vitest";
import {
  formatAskQuestionAnswer,
  readAskQuestionFields,
} from "./askQuestion";

test("a chosen option is reported with its position", () => {
  const fields = readAskQuestionFields({
    question: "Which logger?",
    options: ["zap", "slog"],
  });
  expect(formatAskQuestionAnswer(fields, "slog")).toBe(
    'User selected option 2: "slog"',
  );
});

test("text that is not one of the options is a custom answer", () => {
  const fields = readAskQuestionFields({
    question: "Which logger?",
    options: ["zap", "slog"],
  });
  expect(formatAskQuestionAnswer(fields, "stdlib")).toBe(
    'User provided custom answer: "stdlib"',
  );
});

test("an empty option list is a free-form answer", () => {
  const fields = readAskQuestionFields({
    question: "What should the file be named?",
    options: [],
    defaultAnswer: "handler.go",
  });
  expect(fields.defaultAnswer).toBe("handler.go");
  expect(formatAskQuestionAnswer(fields, "handler.go")).toBe(
    'User answered: "handler.go"',
  );
});

test("a JSON string of options is accepted", () => {
  const fields = readAskQuestionFields({
    question: "Which logger?",
    options: '["zap","slog"]',
    defaultAnswer: null,
  });
  expect(fields.options).toEqual(["zap", "slog"]);
  expect(fields.defaultAnswer).toBeUndefined();
});
