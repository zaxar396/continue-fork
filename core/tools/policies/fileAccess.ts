import { ToolPolicy } from "@continuedev/terminal-security";

/**
 * Evaluates file access policy based on whether the file is in a trusted location.
 * Trusted locations are workspace directories and user-configured allowed directories.
 *
 * @param basePolicy - The base policy from tool definition or user settings
 * @param isTrustedLocation - Whether the file/directory is within workspace or an allowed directory
 * @returns The evaluated policy - more restrictive for files outside trusted locations
 */
export function evaluateFileAccessPolicy(
  basePolicy: ToolPolicy,
  isTrustedLocation: boolean,
): ToolPolicy {
  // If tool is disabled, keep it disabled
  if (basePolicy === "disabled") {
    return "disabled";
  }

  // Files within workspace or an allowed directory use the base policy
  // (typically "allowedWithoutPermission")
  if (isTrustedLocation) {
    return basePolicy;
  }

  // Files outside trusted locations always require permission for security
  return "allowedWithPermission";
}
