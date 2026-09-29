import { describe, expect, it } from "vitest";
import {
  EMPTY_TOOL_LOOP,
  FILE_CYCLE_WINDOW,
  TEXT_LOOP_STOP,
  TOOL_CYCLE_STOP,
  isIntentNarration,
  isRepeatedPhrase,
  turnSpokenText,
  LOOP_RESUME_INSTRUCTION,
  TOOL_LOOP_HARD_THRESHOLD,
  TOOL_LOOP_SOFT_THRESHOLD,
  noteAgentProgress,
  noteToolBatch,
  noteToolBatchOutcome,
  toolBatchSignature,
} from "./toolCallLoop";

const read = (path: string) =>
  toolBatchSignature([
    { name: "read_file", arguments: JSON.stringify({ filepath: path }) },
  ]);

describe("tool call loop", () => {
  it("warns on the third identical call and stops on the fifth", () => {
    let state = EMPTY_TOOL_LOOP;
    const signature = read("catalog.ts");
    const actions: string[] = [];
    for (let i = 0; i < TOOL_LOOP_HARD_THRESHOLD; i++) {
      const noted = noteToolBatch(state, signature);
      state = noted.state;
      actions.push(noted.action);
      state = noteToolBatchOutcome(state, { ok: true, output: "same" });
    }
    expect(actions).toEqual([
      "continue",
      "continue",
      "warn",
      "continue",
      "stop",
    ]);
    expect(TOOL_LOOP_SOFT_THRESHOLD).toBe(3);
  });

  it("resets when a successful result changes", () => {
    let state = EMPTY_TOOL_LOOP;
    const signature = read("catalog.ts");
    state = noteToolBatch(state, signature).state;
    state = noteToolBatchOutcome(state, { ok: true, output: "a" });
    state = noteToolBatch(state, signature).state;
    state = noteToolBatchOutcome(state, { ok: true, output: "b" });
    const third = noteToolBatch(state, signature);
    expect(third.state.consecutive).toBe(2);
    expect(third.action).toBe("continue");
  });

  it("does not treat a failed result as progress", () => {
    let state = EMPTY_TOOL_LOOP;
    const signature = read("catalog.ts");
    state = noteToolBatch(state, signature).state;
    state = noteToolBatchOutcome(state, { ok: false, output: "err-1" });
    state = noteToolBatch(state, signature).state;
    state = noteToolBatchOutcome(state, { ok: false, output: "err-2" });
    const third = noteToolBatch(state, signature);
    expect(third.action).toBe("warn");
  });

  it("warns when the same file is read three times without a successful edit", () => {
    let state = EMPTY_TOOL_LOOP;
    const call = {
      name: "read_file",
      arguments: JSON.stringify({ filepath: "domain.ts" }),
    };
    let last = noteAgentProgress(state, {
      calls: [call],
      assistantText: "Прочитаю доменную модель.",
    });
    state = noteToolBatchOutcome(last.state, { ok: true, output: "contents" });
    last = noteAgentProgress(state, {
      calls: [call],
      assistantText: "Ещё раз посмотрю.",
    });
    state = noteToolBatchOutcome(last.state, { ok: true, output: "contents" });
    last = noteAgentProgress(state, {
      calls: [call],
      assistantText: "Сверюсь с файлом.",
    });
    expect(last.action).toBe("warn");
  });

  it("stops a read and update circle that does not change the file", () => {
    let state = EMPTY_TOOL_LOOP;
    const readCall = {
      name: "read_file",
      arguments: JSON.stringify({ filepath: "domain.ts" }),
    };
    const writeCall = {
      name: "multi_edit",
      arguments: JSON.stringify({ filepath: "domain.ts", edits: [] }),
    };
    let last = noteAgentProgress(EMPTY_TOOL_LOOP, {
      calls: [readCall],
      assistantText: "Шаг 0: смотрю доменную модель, вариант 0.",
    });
    for (let i = 1; i < FILE_CYCLE_WINDOW; i++) {
      state = noteToolBatchOutcome(last.state, { ok: true, output: "same" });
      last = noteAgentProgress(state, {
        calls: [i % 2 === 0 ? readCall : writeCall],
        assistantText: `Шаг ${i}: смотрю доменную модель, вариант ${i}.`,
      });
    }
    expect(last.action).toBe("stop");
    expect(last.notice).toBe(TOOL_CYCLE_STOP);
  });

  it("stops when the same reply is repeated three times", () => {
    let state = EMPTY_TOOL_LOOP;
    const phrase = "Давайте я сделаю это.";
    let last = noteAgentProgress(state, {
      calls: [
        {
          name: "read_file",
          arguments: JSON.stringify({ filepath: "a.ts" }),
        },
      ],
      assistantText: phrase,
    });
    state = noteToolBatchOutcome(last.state, { ok: true, output: "a" });
    last = noteAgentProgress(state, {
      calls: [
        {
          name: "read_file",
          arguments: JSON.stringify({ filepath: "b.ts" }),
        },
      ],
      assistantText: phrase,
    });
    state = noteToolBatchOutcome(last.state, { ok: true, output: "b" });
    last = noteAgentProgress(state, {
      calls: [
        {
          name: "read_file",
          arguments: JSON.stringify({ filepath: "c.ts" }),
        },
      ],
      assistantText: phrase,
    });
    expect(last.action).toBe("stop");
    expect(last.notice).toBe(TEXT_LOOP_STOP);
  });

  it("stops a plan that restates the next step without a tool call", () => {
    const plan = [
      "I now have a comprehensive understanding of the project. This is a very large task. Let me present a structured plan to the user before implementing.",
      "Given the enormous scope of FR2, I'll present a structured plan and then implement it incrementally. Let me first check the existing tests to understand the test patterns, and check the git status.",
      "Let me look at the existing test files and the current git",
    ].join("\n\n");
    expect(isIntentNarration("Let me check the existing tests.")).toBe(false);
    expect(isIntentNarration("Let me know if you want the tests run.")).toBe(
      false,
    );
    expect(isIntentNarration(plan)).toBe(true);
  });

  it("stops when one sentence is repeated between different neighbors", () => {
    const shared = "Let me read the FR3 section of the analytics document.";
    const withTool =
      "I'll use the read_file tool to read the file and find the FR3 section.";
    const withoutTool = "I'll read the file and find the FR3 section.";
    const once = [shared, withTool, shared, withoutTool].join(" ");
    const twice = `${once} ${shared} ${withTool}`;
    expect(isRepeatedPhrase(once)).toBe(false);
    expect(isRepeatedPhrase(twice)).toBe(true);
  });

  it("stops alternating sentences inside one reply", () => {
    const phrase = [
      "Let me look at the conf package.",
      "Let me check the conf.Jaeger struct.",
    ].join("\n\n");
    expect(isRepeatedPhrase(phrase)).toBe(false);
    expect(isRepeatedPhrase(`${phrase}\n\n${phrase}\n\n${phrase}`)).toBe(true);
  });

  it("stops a four-sentence cycle inside one reply", () => {
    const phrase = [
      "Let me add the LkOffers DTOs and the SearchLkOffers method.",
      "Let me add the LkOffers DTO to dto.go.",
      "Let me add the LkOffersSearchRequest and LkOffersSearchResponse DTOs to dto.go.",
      "Let me add these to the dto.go file.",
    ].join("\n\n");
    expect(isRepeatedPhrase(`${phrase}\n\n${phrase}`)).toBe(false);
    expect(isRepeatedPhrase(`${phrase}\n\n${phrase}\n\n${phrase}`)).toBe(true);
  });

  it("stops a five-sentence cycle inside one reply", () => {
    const phrase = [
      "Let me add the request type.",
      "Let me add the response type.",
      "Let me add the mapper.",
      "Let me add the handler.",
      "Let me wire the route.",
    ].join("\n\n");
    expect(isRepeatedPhrase(`${phrase}\n\n${phrase}`)).toBe(false);
    expect(isRepeatedPhrase(`${phrase}\n\n${phrase}\n\n${phrase}`)).toBe(true);
  });

  it("joins thinking blocks in the current turn before the empty assistant", () => {
    const lines = [
      "Let me add the LkOffers mapper function to mapper.go.",
      "Let me add the toDomainLkOffers function at the end of mapper.go.",
      "Let me add it after the toDomainFlex function.",
    ];
    const history = [
      { message: { role: "user", content: "add the mapper" } },
      ...Array.from({ length: 3 }, () => lines)
        .flat()
        .map((line) => ({ message: { role: "thinking", content: line } })),
      { message: { role: "assistant", content: "" } },
    ];
    expect(isRepeatedPhrase(history.at(-1)?.message.content ?? "")).toBe(false);
    expect(isRepeatedPhrase(turnSpokenText(history))).toBe(true);
  });

  it("asks the model to continue in the user's language", () => {
    expect(LOOP_RESUME_INSTRUCTION).toBe(
      "Continue the task from the last step. Reply in the same language as the user.",
    );
  });

  it("resets the streak when the arguments change", () => {
    let state = noteToolBatch(EMPTY_TOOL_LOOP, read("a.ts")).state;
    state = noteToolBatch(state, read("a.ts")).state;
    const changed = noteToolBatch(state, read("b.ts"));
    expect(changed.state.consecutive).toBe(1);
    expect(changed.action).toBe("continue");
  });
});
