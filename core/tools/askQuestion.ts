export interface AskQuestionFields {
  question: string;
  options: string[];
  defaultAnswer?: string;
}

function asOptionList(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    try {
      return asOptionList(JSON.parse(trimmed));
    } catch {
      return [trimmed];
    }
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function readAskQuestionFields(
  args: Record<string, unknown> | undefined,
): AskQuestionFields {
  const question =
    typeof args?.question === "string" ? args.question.trim() : "";
  const defaultAnswer =
    typeof args?.defaultAnswer === "string" ? args.defaultAnswer.trim() : "";
  return {
    question,
    options: asOptionList(args?.options),
    ...(defaultAnswer ? { defaultAnswer } : {}),
  };
}

/** Same wording the CLI returns to the model. */
export function formatAskQuestionAnswer(
  fields: AskQuestionFields,
  answer: string,
): string {
  if (fields.options.length > 0) {
    const selectedIndex = fields.options.indexOf(answer);
    if (selectedIndex !== -1) {
      return `User selected option ${selectedIndex + 1}: "${answer}"`;
    }
    return `User provided custom answer: "${answer}"`;
  }
  return `User answered: "${answer}"`;
}
