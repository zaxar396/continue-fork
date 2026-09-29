import { setOutputLogSink } from "core/util/outputLog";
import * as vscode from "vscode";

let channel: vscode.OutputChannel | undefined;

export function getContinueOutputChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel("Continue");
    setOutputLogSink((line) => channel?.appendLine(line));
    channel.appendLine(
      `${new Date().toISOString()} ready Continue event log`,
    );
  }
  return channel;
}

export function showContinueOutputChannel(): void {
  getContinueOutputChannel().show(true);
}
