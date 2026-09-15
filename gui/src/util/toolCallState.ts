import { ToolPolicy } from "@continuedev/terminal-security";
import { ToolCallDelta, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { incrementalParseJson } from "core/util/incrementalParseJson";

// Merge streamed tool calls
// See example of data coming in here:
// https://platform.openai.com/docs/guides/function-calling?api-mode=chat#streaming
export function addToolCallDeltaToState(
  toolCallDelta: ToolCallDelta,
  currentState: ToolCallState | undefined,
): ToolCallState {
  const currentCall = currentState?.toolCall;

  // If we have a current state and the delta has a different ID, ignore the delta
  if (
    currentState &&
    toolCallDelta.id &&
    currentCall?.id !== toolCallDelta.id
  ) {
    return currentState;
  }

  // These will/should not be partially streamed
  const callType = toolCallDelta.type ?? "function";
  const callId = currentCall?.id || toolCallDelta.id || "";

  // These may be streamed in chunks
  const currentName = currentCall?.function.name ?? "";
  const currentArgs = currentCall?.function.arguments ?? "";

  const nameDelta = toolCallDelta.function?.name ?? "";
  const argsDelta = toolCallDelta.function?.arguments ?? "";

  let mergedName = currentName;
  if (nameDelta.startsWith(currentName)) {
    // Case where model progresssively streams name but full name each time e.g. "readFi" -> "readFil" -> "readFile"
    mergedName = nameDelta;
  } else if (!currentName.startsWith(nameDelta)) {
    mergedName = currentName + nameDelta;
  }

  // Similar logic for args, with an extra JSON check
  let mergedArgs = currentArgs;
  try {
    // If args is JSON parseable, it is complete, don't add to it
    JSON.parse(currentArgs);
  } catch (e) {
    // Model streams in args in parts e.g. "{"file": "file1"" -> ", "line": 1}"
    mergedArgs = currentArgs + argsDelta;

    // Note, removed case where model progresssively streams args but full args each time e.g. "{"file": "file1"}" -> "{"file": "file1", "line": 1}"
    // Because no apis do this and difficult to detect reliably
  }

  const [_, parsedArgs] = incrementalParseJson(mergedArgs || "{}");

  return {
    status: "generating",
    toolCall: {
      id: callId,
      type: callType,
      function: {
        name: mergedName,
        arguments: mergedArgs,
      },
    },
    toolCallId: callId,
    parsedArgs,
  };
}

const editToolNames: string[] = [
  BuiltInToolNames.EditExistingFile,
  BuiltInToolNames.SingleFindAndReplace,
  BuiltInToolNames.MultiEdit,
];
export function isEditTool(toolName: string) {
  return editToolNames.includes(toolName);
}

/** File write tools that should execute without an Accept click. */
export function shouldSkipToolPermissionPrompt(toolName: string) {
  return isEditTool(toolName) || toolName === BuiltInToolNames.CreateNewFile;
}

export function isMcpTool(tool?: { uri?: string } | null): boolean {
  return !!tool?.uri?.startsWith("mcp:");
}

export function isTerminalCommandTool(toolName: string): boolean {
  return toolName === BuiltInToolNames.RunTerminalCommand;
}

export interface AutoRunSettings {
  autoRunSafeTerminalCommands: boolean;
  autoRunDangerousTerminalCommands: boolean;
  autoRunMcpTools: boolean;
}

/**
 * Applies auto-run toggles on top of the stored tool policy and the
 * command-level security evaluation.
 *
 * Safe terminal commands are the security whitelist (ls, git status, …).
 * Dangerous terminal commands are Ask First plus blocked (curl, sudo, rm -rf, …).
 * MCP tools have no command-level classifier — the toggle covers every call.
 */
export function resolveAutoRunPolicy(
  toolName: string,
  tool: { uri?: string } | undefined,
  basePolicy: ToolPolicy,
  dynamicPolicy: ToolPolicy,
  autoRun: AutoRunSettings,
): ToolPolicy {
  if (basePolicy === "disabled") {
    return "disabled";
  }

  if (autoRun.autoRunMcpTools && isMcpTool(tool)) {
    return "allowedWithoutPermission";
  }

  if (!isTerminalCommandTool(toolName)) {
    return dynamicPolicy;
  }

  const isDangerousCommand =
    dynamicPolicy === "disabled" ||
    dynamicPolicy === "allowedWithPermission";

  if (isDangerousCommand) {
    if (autoRun.autoRunDangerousTerminalCommands) {
      return "allowedWithoutPermission";
    }
    return dynamicPolicy;
  }

  if (autoRun.autoRunSafeTerminalCommands) {
    return "allowedWithoutPermission";
  }

  return "allowedWithPermission";
}

export function shouldAutoAcceptApplyDiff(
  toolName: string | undefined,
  storedPolicy: ToolPolicy | undefined,
  defaultPolicy?: ToolPolicy,
): boolean {
  if (!toolName) {
    return false;
  }

  const effectivePolicy = storedPolicy ?? defaultPolicy;
  if (effectivePolicy === "disabled") {
    return false;
  }

  if (isEditTool(toolName)) {
    return true;
  }

  return effectivePolicy === "allowedWithoutPermission";
}
