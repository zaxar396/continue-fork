import { prepareMultiEdit } from "core/tools/definitions/multiEdit";
import { ClientToolImpl } from "./callClientTool";
import { finishPreparedWrite } from "./finishPreparedWrite";

export const multiEditImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const prepared = await prepareMultiEdit(args, extras.ideMessenger.ide);
  return finishPreparedWrite(prepared, toolCallId, extras);
};
