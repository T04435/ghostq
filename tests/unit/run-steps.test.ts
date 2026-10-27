import { describe, expect, it } from "vitest";
import { applyStepEvent, stepCount, type StepItem } from "@/components/run-steps";
import type { RunEvent } from "@/lib/run-events";

/** Folds a list of run events into the step list, as the page does. */
const run = (events: RunEvent[]) => events.reduce<StepItem[]>((items, e, n) => applyStepEvent(items, e, n), []);
const start = (id: string, tool: string, input: unknown): RunEvent => ({ type: "step-start", id, tool, label: tool, input });
const end = (id: string, ok: boolean, summary: string): RunEvent => ({ type: "step-end", id, ok, summary, signals: [] });

describe("a failed step and its retry", () => {
  it("fold into one step when the call errored", () => {
    const items = run([start("a", "style_refs", { n: 5 }), end("a", false, "Request timed out"), start("b", "style_refs", { n: 8 }), end("b", true, "8 artists")]);
    expect(stepCount(items)).toBe(1);
  });

  it("fold when an empty call is asked again the same way", () => {
    const items = run([start("a", "crowd_tags", { kind: "style" }), end("a", false, "No style tags came back."), start("b", "crowd_tags", { kind: "style" }), end("b", true, "6 tags")]);
    expect(stepCount(items)).toBe(1);
  });

  it("stay apart when the empty call was a different question", () => {
    const items = run([start("a", "crowd_tags", { kind: "style" }), end("a", false, "No style tags came back."), { type: "note", text: "Next, genres." }, start("b", "crowd_tags", { kind: "genre" }), end("b", true, "10 genres")]);
    expect(stepCount(items)).toBe(2);
  });
});
