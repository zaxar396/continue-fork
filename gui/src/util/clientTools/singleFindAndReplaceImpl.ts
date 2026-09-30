import { prepareSingleFind } from "core/tools/definitions/singleFindAndReplace";
import { ClientToolImpl } from "./callClientTool";
import { finishPreparedWrite } from "./finishPreparedWrite";

export const singleFindAndReplaceImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const prepared = await prepareSingleFind(args, extras.ideMessenger.ide);
  return finishPreparedWrite(prepared, toolCallId, extras);
};
