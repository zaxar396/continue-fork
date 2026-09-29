type OutputLogSink = (line: string) => void;

let sink: OutputLogSink | undefined;

export function setOutputLogSink(next: OutputLogSink | undefined): void {
  sink = next;
}

export function outputLog(
  event: string,
  details?: Record<string, unknown>,
): void {
  if (!sink) {
    return;
  }
  const extra = details ? ` ${JSON.stringify(details)}` : "";
  sink(`${new Date().toISOString()} ${event}${extra}`);
}

export function errorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
