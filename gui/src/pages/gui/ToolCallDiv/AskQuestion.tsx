import { ToolCallState } from "core";
import { readAskQuestionFields } from "core/tools/askQuestion";
import { useState } from "react";
import { Button } from "../../../components/ui";
import { submitQuestionAnswer } from "../../../util/clientTools/questionWaiter";

export function AskQuestion({
  toolCallState,
}: {
  toolCallState: ToolCallState;
}) {
  const fields = readAskQuestionFields(toolCallState.parsedArgs);
  const [customAnswer, setCustomAnswer] = useState("");
  const [sent, setSent] = useState(false);
  const waiting = toolCallState.status === "calling" && !sent;
  const answer = toolCallState.output?.find((item) => item.content)?.content;

  const send = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || sent) {
      return;
    }
    if (!submitQuestionAnswer(toolCallState.toolCallId, trimmed)) {
      return;
    }
    setSent(true);
  };

  const sendCustom = () => {
    send(customAnswer || fields.defaultAnswer || "");
  };

  return (
    <div className="flex flex-col gap-2 pb-2">
      {fields.question ? (
        <div className="text-xs font-medium">{fields.question}</div>
      ) : null}

      {waiting ? (
        <>
          {fields.options.length > 0 ? (
            <div className="flex flex-col gap-1">
              {fields.options.map((option, index) => (
                <Button
                  key={`${index}-${option}`}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="border-border h-auto justify-start border px-2 py-1 text-left whitespace-normal"
                  onClick={() => send(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          ) : null}
          <form
            className="flex items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              sendCustom();
            }}
          >
            <input
              className="border-input-border bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus box-border min-w-0 flex-1 rounded border px-2 py-1 text-xs focus:outline-none"
              value={customAnswer}
              placeholder={
                fields.options.length > 0
                  ? "Or type your own answer"
                  : "Type your answer"
              }
              onChange={(event) => setCustomAnswer(event.target.value)}
            />
            <Button type="submit" variant="primary" size="sm">
              Send
            </Button>
          </form>
          {fields.defaultAnswer && !customAnswer ? (
            <div className="text-description text-2xs">
              Enter uses the default: {fields.defaultAnswer}
            </div>
          ) : null}
        </>
      ) : null}

      {toolCallState.status === "done" && answer ? (
        <div className="text-description text-xs">{answer}</div>
      ) : null}
    </div>
  );
}
