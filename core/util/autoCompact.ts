/**
 * Same 80% ratio the CLI uses (`AUTO_COMPACT_BUFFER_RATIO`).
 * GUI context percentage is input tokens divided by the usable input budget
 * (context length minus safety buffer and reserved output tokens).
 */
export const AUTO_COMPACT_CONTEXT_RATIO = 0.8;

export function shouldAutoCompactContext(options: {
  contextPercentage?: number;
  didPrune?: boolean;
  notEnoughContext?: boolean;
}): boolean {
  if (options.notEnoughContext || options.didPrune) {
    return true;
  }
  return (options.contextPercentage ?? 0) >= AUTO_COMPACT_CONTEXT_RATIO;
}
