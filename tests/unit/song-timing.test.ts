import { describe, expect, it } from "vitest";
import { fitTiming, PLANNED_SECONDS, planTiming, positionAt, shortName, timingForPrompt, wordAt } from "@/lib/song-timing";

const line = (text: string) => ({ text, chords: "Am F", signalIds: ["T1"] });
const sheet = {
  tempo: 120,
  sections: [
    { name: "Verse 1", melody: "", lines: [line("one two three"), line("four five six")] },
    { name: "Chorus", melody: "", lines: [line("la la la"), line("la la la"), line("la la la"), line("la la la")] },
    { name: "Instrumental", melody: "", lines: [line("(guitar)"), line("(guitar)")] },
    { name: "Verse 2", melody: "", lines: [line("seven eight"), line("nine ten")] },
  ],
};

describe("planTiming", () => {
  const plan = planTiming(sheet);

  it("fills exactly the planned length, intro and outro around the sheet", () => {
    expect(plan.sections[0].name).toBe("Intro");
    expect(plan.sections.at(-1)!.name).toBe("Outro");
    expect(plan.sections[0].start).toBe(0);
    expect(plan.sections.at(-1)!.end).toBeCloseTo(PLANNED_SECONDS);
    plan.sections.slice(1).forEach((s, i) => expect(s.start).toBeCloseTo(plan.sections[i].end));
  });

  it("times every sung line in order, inside its section, and skips instrumental sections", () => {
    expect(plan.lines).toHaveLength(2 + 4 + 2);
    expect(plan.lines.map((l) => l.section)).toEqual([0, 0, 1, 1, 1, 1, 3, 3]);
    plan.lines.forEach((l, i) => {
      const s = plan.sections[l.section + 1];
      expect(l.start).toBeGreaterThanOrEqual(s.start - 1e-9);
      expect(l.end).toBeLessThanOrEqual(s.end + 1e-9);
      if (i) expect(l.start).toBeGreaterThanOrEqual(plan.lines[i - 1].end - 1e-9);
    });
  });

  it("stretches to the real track", () => {
    const fit = fitTiming(plan, PLANNED_SECONDS * 1.1);
    expect(fit.sections.at(-1)!.end).toBeCloseTo(PLANNED_SECONDS * 1.1);
    expect(fit.lines[0].start / plan.lines[0].start).toBeCloseTo(1.1);
  });

  it("writes Lyria's timestamp lines", () => {
    const text = timingForPrompt(plan);
    expect(text.split("\n")[0]).toMatch(/^\[0:00 - 0:\d\d\] Intro$/);
    expect(text.split("\n").at(-1)).toMatch(/\] Outro$/);
    expect(text).toContain("] Verse 1");
  });
});

describe("positionAt and wordAt", () => {
  const plan = planTiming(sheet);
  it("finds the line being sung, and none in the intro", () => {
    expect(positionAt(plan, 1).line).toBe(-1);
    expect(positionAt(plan, 1).next).toBe(0);
    const mid = (plan.lines[3].start + plan.lines[3].end) / 2;
    expect(positionAt(plan, mid)).toMatchObject({ line: 3, section: 2 });
  });
  it("walks through the words, then the breath", () => {
    const l = plan.lines[0];
    expect(wordAt("one two three", l, l.start - 0.1)).toBe(-1);
    expect(wordAt("one two three", l, l.start + 0.01)).toBe(0);
    expect(wordAt("one two three", l, l.end - 0.01)).toBe(3);
  });
  it("labels the song map", () => {
    expect(["Verse 1", "Pre-Chorus", "Chorus", "Bridge", "Intro", "Outro", "Estribillo", "Final Chorus"].map(shortName)).toEqual(["V1", "Pre", "Ch", "Br", "In", "Out", "Ch", "Ch"]);
  });
});
