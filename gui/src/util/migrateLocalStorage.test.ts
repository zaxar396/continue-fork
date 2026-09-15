import { AUTO_APPROVE_BY_DEFAULT_TOOL_NAMES } from "core/tools/builtIn";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { migrateLocalStorage } from "./migrateLocalStorage";

describe("migrateLocalStorage auto-approve write tools", () => {
  const dispatch = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("sets write and terminal tools to automatic once", () => {
    migrateLocalStorage(dispatch);

    for (const toolName of AUTO_APPROVE_BY_DEFAULT_TOOL_NAMES) {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            toolName,
            policy: "allowedWithoutPermission",
          },
        }),
      );
    }

    dispatch.mockClear();
    migrateLocalStorage(dispatch);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not override a disabled write tool", () => {
    localStorage.setItem(
      "persist:root",
      JSON.stringify({
        ui: JSON.stringify({
          toolSettings: {
            run_terminal_command: "disabled",
          },
        }),
      }),
    );

    migrateLocalStorage(dispatch);

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          toolName: "run_terminal_command",
          policy: "allowedWithoutPermission",
        },
      }),
    );
  });
});
