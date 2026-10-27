import { describe, expect, it } from "vitest";
import { resumeBrief } from "@/lib/research-resume";
import type { Signal } from "@/lib/signals";

const signal = (id: string, label: string): Signal => ({ id, kind: "theme", label, source: "Qloo insights", value: 0.8 }) as Signal;

describe("resumeBrief", () => {
  it("tells the resumed agent what already ran and what it found", () => {
    const out = resumeBrief([{ tool: "crowd_tags", input: { kind: "theme" } }], [signal("S1", "heartbreak")]);
    expect(out).toContain('crowd_tags {"kind":"theme"}');
    expect(out).toContain("S1 [theme] heartbreak (0.8), from Qloo insights");
    expect(out).toContain("don't repeat them");
  });

  it("says none when nothing ran yet", () => {
    expect(resumeBrief([], [])).toContain("already ran (don't repeat them): none.");
  });
});
