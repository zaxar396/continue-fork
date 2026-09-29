import { unwrapResult } from "@reduxjs/toolkit";
import { shouldAutoCompactContext } from "core/util/autoCompact";
import { IIdeMessenger } from "../../context/IdeMessenger";
import {
  setCompactionLoading,
  setConversationSummary,
} from "../slices/sessionSlice";
import { AppDispatch, RootState } from "../store";
import { saveCurrentSession } from "./session";

function isEmptyAssistantPlaceholder(
  item: RootState["session"]["history"][number] | undefined,
): boolean {
  if (!item || item.message.role !== "assistant") {
    return false;
  }
  const content =
    typeof item.message.content === "string" ? item.message.content.trim() : "";
  const hasToolCalls = !!item.message.toolCalls?.length;
  return !content && !hasToolCalls && !item.toolCallStates?.length;
}

/**
 * Index of the message that will carry the summary.
 * Messages after this index stay in the next request, so the marker must sit
 * before the current user turn. Marking the user message itself drops it and
 * leaves no user or tool message for the following compile.
 */
export function compactionIndex(
  history: RootState["session"]["history"],
): number {
  if (history.length < 2) {
    return -1;
  }
  let anchor = history.length - 1;
  if (isEmptyAssistantPlaceholder(history[anchor])) {
    anchor -= 1;
  }
  if (history[anchor]?.message.role === "user") {
    return anchor - 1;
  }
  return anchor;
}

/**
 * Summarize the session when context is near the CLI auto-compact threshold,
 * then keep the in-progress turn alive. Returns true when a summary was stored.
 */
export async function autoCompactHistoryIfNeeded(args: {
  dispatch: AppDispatch;
  getState: () => RootState;
  ideMessenger: IIdeMessenger;
  contextPercentage?: number;
  didPrune?: boolean;
  notEnoughContext?: boolean;
}): Promise<boolean> {
  const {
    dispatch,
    getState,
    ideMessenger,
    contextPercentage,
    didPrune,
    notEnoughContext,
  } = args;

  if (
    !shouldAutoCompactContext({
      contextPercentage,
      didPrune,
      notEnoughContext,
    })
  ) {
    return false;
  }

  const state = getState();
  if (!state.session.isStreaming || state.session.history.length < 2) {
    return false;
  }

  const index = compactionIndex(state.session.history);
  if (index < 0) {
    return false;
  }

  dispatch(setCompactionLoading({ index, loading: true }));
  try {
    unwrapResult(
      await dispatch(
        saveCurrentSession({
          openNewSession: false,
          generateTitle: false,
        }),
      ),
    );

    if (getState().session.streamAborter.signal.aborted) {
      return false;
    }

    const result = await ideMessenger.request("conversation/compact", {
      index,
      sessionId: state.session.id,
    });
    if (result.status !== "success" || !result.content?.trim()) {
      return false;
    }

    dispatch(
      setConversationSummary({
        index,
        summary: result.content,
      }),
    );
    return true;
  } catch (error) {
    console.error("Auto-compaction failed:", error);
    return false;
  } finally {
    dispatch(setCompactionLoading({ index, loading: false }));
  }
}
