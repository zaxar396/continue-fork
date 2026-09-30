import {
  formatAskQuestionAnswer,
  readAskQuestionFields,
} from "core/tools/askQuestion";
import { cancelToolCall } from "../../redux/slices/sessionSlice";
import { ClientToolExtras, ClientToolOutput } from "./callClientTool";
import {
  QuestionCancelled,
  waitForQuestionAnswer,
} from "./questionWaiter";

export async function askQuestionImpl(
  args: Record<string, unknown>,
  toolCallId: string,
  extras: ClientToolExtras,
): Promise<ClientToolOutput> {
  const fields = readAskQuestionFields(args);
  if (!fields.question) {
    throw new Error("ask_question requires a question");
  }

  const signal = extras.getState().session.streamAborter.signal;
  try {
    const answer = await waitForQuestionAnswer(toolCallId, signal);
    return {
      respondImmediately: true,
      output: [
        {
          name: "Ask Question",
          description: "User answer",
          content: formatAskQuestionAnswer(fields, answer),
          hidden: true,
        },
      ],
    };
  } catch (error) {
    if (error instanceof QuestionCancelled) {
      extras.dispatch(cancelToolCall({ toolCallId }));
      return { respondImmediately: false, output: undefined };
    }
    throw error;
  }
}
