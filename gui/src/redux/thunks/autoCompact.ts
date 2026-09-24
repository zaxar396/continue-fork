import { unwrapResult } from "@reduxjs/toolkit";
import { shouldAutoCompactContext } from "core/util/autoCompact";
import { IIdeMessenger } from "../../context/IdeMessenger";
import {
  setCompactionLoading,
  setConversationSummary,
} from "../slices/sessionSlice";
import { AppDispatch, RootState } from "../store";
import { saveCurrentSession } from "./session";

function compactionIndex(history: RootState["session"]["history"]): number {
  const last = history[history.length - 1];
  const content =
    typeof last?.message.content === "string" ? last.message.content.trim() : "";
  const hasToolCalls =
    last?.message.role === "assistant" && !!last.message.toolCalls?.length;
  if (
    history.length >= 2 &&
    last?.message.role === "assistant" &&
    !content &&
    !hasToolCalls &&
    !last.toolCallStates?.length
  ) {
    return history.length - 2;
  }
  return history.length - 1;
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
