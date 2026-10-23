import { describe, expect, it } from "vitest";
import { craftProblems, rhymes, syllables } from "@/lib/craft";

const song = (sections: [string, string[]][], extra: Partial<{ title: string; genre: string; vocalDirection: string }> = {}) => ({
  title: extra.title ?? "Shore Road",
  genre: extra.genre ?? "Indie pop",
  vocalDirection: extra.vocalDirection ?? "Sung softly",
  sections: sections.map(([name, lines]) => ({ name, melody: "m", lines: lines.map((text) => ({ text, chords: "Am", signalIds: ["T1"] })) })),
});

describe("syllables and rhyme", () => {
  it("counts syllables roughly, across languages", () => {
    expect(syllables("Up at six the footpath")).toBe(6);
    expect(syllables("make it home")).toBe(3);
    expect(syllables("mi corazón")).toBe(4);
  });

  it("hears end rhymes and assonance", () => {
    expect(rhymes("hold the light", "out all night")).toBe(true);
    expect(rhymes("mi corazón", "una canción")).toBe(true);
    expect(rhymes("hold the light", "the harbour turn")).toBe(false);
  });
});

describe("craftProblems", () => {
  it("passes a song that keeps the rules", () => {
    const ok = song([
      ["Verse 1", ["I run the hill at night", "the harbour holds the light", "we drive the long way round", "the windows down"]],
      ["Chorus", ["Take me down the Shore Road", "before the summer's gone", "take me down the Shore Road", "and hold on"]],
      ["Verse 2", ["You call me from the bus", "the city full of us", "we laugh the long way round", "the windows down"]],
    ]);
    expect(craftProblems(ok)).toEqual([]);
  });

  it("flags the missing hook, filler, a verse that doesn't fit and a section with no rhyme", () => {
    const bad = song([
      ["Verse 1", ["short line here", "another short one", "and then a third", "the fourth is plain"]],
      ["Chorus", ["oh oh oh oh, yeah yeah", "nothing about the title", "still nothing here at all"]],
      ["Verse 2", ["this second verse line one runs far too long for the melody that verse one had", "two", "three", "four"]],
    ]);
    const issues = craftProblems(bad).map((p) => `${p.where}: ${p.issue.split(" ")[0]} ${p.issue.split(" ")[1]}`);
    expect(issues[0]).toMatch(/^Chorus, line 1: doesn't carry/);
    expect(issues).toContain("Chorus, line 1: is filler");
    expect(issues.some((i) => i.startsWith("Verse 2, line 1: has"))).toBe(true);
    expect(issues.some((i) => i.startsWith("Chorus, line 3: the section"))).toBe(true);
  });

  it("doesn't cap a rapped song's line length", () => {
    const long = "word ".repeat(26).trim();
    const sung = song([["Chorus", ["Shore Road", long]]]);
    expect(craftProblems(sung).some((p) => p.issue.includes("too long"))).toBe(true);
    expect(craftProblems({ ...sung, vocalDirection: "Rapped, fast" }).some((p) => p.issue.includes("too long"))).toBe(false);
  });

  it("checks only the hook and filler in a non-Latin script", () => {
    const ko = song([["Verse 1", ["서울의 밤은 길고", "우리는 걷는다", "불빛 아래서", "너를 기다려"]], ["Chorus", ["Shore Road 너와 함께", "노래해"]]]);
    expect(craftProblems(ko)).toEqual([]);
  });
});
