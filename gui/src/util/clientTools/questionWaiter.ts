export class QuestionCancelled extends Error {
  constructor() {
    super("The question was cancelled");
    this.name = "QuestionCancelled";
  }
}

interface Waiter {
  finish: (answer: string) => void;
}

const pending = new Map<string, Waiter>();

export function waitForQuestionAnswer(
  toolCallId: string,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      signal.removeEventListener("abort", onAbort);
      pending.delete(toolCallId);
      fn();
    };
    const onAbort = () => {
      settle(() => reject(new QuestionCancelled()));
    };

    if (signal.aborted) {
      reject(new QuestionCancelled());
      return;
    }

    signal.addEventListener("abort", onAbort);
    pending.set(toolCallId, {
      finish: (answer) => settle(() => resolve(answer)),
    });
  });
}

export function submitQuestionAnswer(
  toolCallId: string,
  answer: string,
): boolean {
  const waiter = pending.get(toolCallId);
  if (!waiter) {
    return false;
  }
  waiter.finish(answer);
  return true;
}
