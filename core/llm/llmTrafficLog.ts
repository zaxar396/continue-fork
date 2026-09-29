import * as fs from "fs";

import { GlobalContext } from "../util/GlobalContext.js";
import { getLogsDirPath } from "../util/paths.js";

export function llmTrafficLogEnabled(
  shared: { logLlmTraffic?: boolean } | undefined,
): boolean {
  return shared?.logLlmTraffic === true;
}

export function isLlmTrafficLogEnabled(): boolean {
  try {
    return llmTrafficLogEnabled(new GlobalContext().getSharedConfig());
  } catch {
    return false;
  }
}

export function llmLogFilePath(): string {
  return `${getLogsDirPath()}/llm.log`;
}

function stamp(): string {
  return new Date().toISOString();
}

export function logLlmRequest(args: {
  model: string;
  provider: string;
  request: unknown;
}): string | undefined {
  if (!isLlmTrafficLogEnabled()) {
    return undefined;
  }
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const body =
    typeof args.request === "string"
      ? args.request
      : JSON.stringify(args.request, null, 2);
  fs.appendFileSync(
    llmLogFilePath(),
    `\n===== ${stamp()} id=${id} model=${args.model} provider=${args.provider}\n--- request ---\n${body}\n`,
  );
  return id;
}

export function logLlmResponse(args: {
  id: string | undefined;
  response: string;
  thinking?: string;
  error?: unknown;
}): void {
  if (!args.id || !isLlmTrafficLogEnabled()) {
    return;
  }
  const errorText =
    args.error instanceof Error
      ? args.error.message
      : args.error
        ? String(args.error)
        : "";
  const thinking = args.thinking?.trim()
    ? `--- thinking ---\n${args.thinking}\n`
    : "";
  const error = errorText ? `--- error ---\n${errorText}\n` : "";
  fs.appendFileSync(
    llmLogFilePath(),
    `--- response id=${args.id} ${stamp()} ---\n${thinking}${args.response}\n${error}`,
  );
}
