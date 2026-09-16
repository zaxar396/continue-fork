import {
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import { ToolTip } from "../../../components/gui/Tooltip";
import { IdeMessengerContext } from "../../../context/IdeMessenger";

function parseDirectoryList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function serializeDirectoryList(directories: string[]): string {
  return directories.join("\n");
}

export function AllowedDirectoriesSetting() {
  const ideMessenger = useContext(IdeMessengerContext);
  const [savedValue, setSavedValue] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ideMessenger.ide
      .getIdeSettings()
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const serialized = serializeDirectoryList(
          settings.allowedDirectories ?? [],
        );
        setSavedValue(serialized);
        setDraftValue(serialized);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ideMessenger]);

  const isDirty = loaded && draftValue !== savedValue;

  const handleSave = () => {
    const directories = parseDirectoryList(draftValue);
    const serialized = serializeDirectoryList(directories);
    void ideMessenger
      .request("updateAllowedDirectories", directories)
      .then(() => {
        setSavedValue(serialized);
        setDraftValue(serialized);
      });
  };

  const handleCancel = () => {
    setDraftValue(savedValue);
  };

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-col">
        <span className="text-sm font-medium">
          Allowed directories outside workspace
        </span>
        <p className="mt-0.5 text-xs text-gray-500">
          Absolute paths Continue may read and list without asking for
          confirmation. Each path also includes all subdirectories. One path per
          line.
        </p>
      </div>
      <div className="flex items-start gap-2">
        <div
          className={`border-command-border bg-vsc-input-background focus-within:border-border-focus focus-within:ring-border-focus flex w-full overflow-hidden rounded-md border border-solid focus-within:ring-1 ${
            isDirty ? "outline outline-green-500" : ""
          }`}
        >
          <textarea
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            placeholder={"C:/Users/you/go/pkg/mod\nC:/Program Files/Go/src"}
            rows={3}
            className="text-vsc-foreground min-h-16 w-full resize-y border-none bg-inherit px-1.5 py-1 font-mono text-xs outline-none ring-0 focus:border-none focus:outline-none focus:ring-0"
          />
        </div>
        {isDirty && (
          <div className="flex flex-row items-center gap-1 pt-1">
            <ToolTip content="Save">
              <div onClick={handleSave} className="cursor-pointer">
                <CheckIcon className="h-4 w-4 text-green-500 hover:opacity-80" />
              </div>
            </ToolTip>
            <ToolTip content="Cancel">
              <div onClick={handleCancel} className="cursor-pointer">
                <XMarkIcon className="h-4 w-4 text-red-500 hover:opacity-80" />
              </div>
            </ToolTip>
          </div>
        )}
      </div>
    </div>
  );
}
