import { getCleanUriPath, getUriPathBasename } from "core/util/uri";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolExtras, ClientToolOutput } from "./callClientTool";

export async function finishPreparedWrite(
  prepared: {
    creating: boolean;
    fileUri: string;
    newFileContents: string;
  },
  toolCallId: string,
  extras: ClientToolExtras,
): Promise<ClientToolOutput> {
  if (prepared.creating) {
    await extras.ideMessenger.ide.writeFile(
      prepared.fileUri,
      prepared.newFileContents,
    );
    await extras.ideMessenger.ide.openFile(prepared.fileUri);
    await extras.ideMessenger.ide.saveFile(prepared.fileUri);
    return {
      respondImmediately: true,
      output: [
        {
          name: getUriPathBasename(prepared.fileUri),
          description: getCleanUriPath(prepared.fileUri),
          content: "File created successfully",
          uri: {
            type: "file",
            value: prepared.fileUri,
          },
        },
      ],
    };
  }

  const streamId = uuid();
  void extras.dispatch(
    applyForEditTool({
      streamId,
      toolCallId,
      text: prepared.newFileContents,
      filepath: prepared.fileUri,
      isSearchAndReplace: true,
    }),
  );
  return {
    respondImmediately: false,
    output: undefined,
  };
}
