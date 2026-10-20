import { describe, expect, it } from "vitest";
import { SignalRegistry } from "@/lib/signals";
import type { WrittenSong } from "@/lib/song-sheet";
import { dropUnknownIds, validateSong } from "@/lib/validate-sheet";

const registry = new SignalRegistry();
const love = registry.add("theme", "Love", "Qloo insights", 0.75);
const film = registry.add("movie", "Little Women", "Qloo insights", 0.8);
registry.add("theme", "love", "Qloo insights", 0.7); // same label: no new signal

function song(lines: { text: string; signalIds: string[] }[]): WrittenSong {
  return {
    title: "T",
    key: "A minor",
    tempo: 96,
    feel: "f",
    productionBrief: "p",
    angle: "a",
    sections: [{ name: "Verse 1", melody: "m", lines: lines.map((l) => ({ ...l, chords: "Am F" })) }],
  };
}

describe("SignalRegistry", () => {
  it("gives short ids per kind and dedupes labels", () => {
    expect(love.id).toBe("T1");
    expect(film.id).toBe("M1");
    expect(registry.all()).toHaveLength(2);
  });
});

describe("validateSong", () => {
  it("passes a song where every line cites a real signal", () => {
    expect(validateSong(song([{ text: "Hold me on the tram", signalIds: ["T1"] }, { text: "Ink on my sleeve", signalIds: ["M1", "T1"] }]), registry.all(), [])).toEqual([]);
  });

  it("flags missing and unknown citations", () => {
    const problems = validateSong(song([{ text: "a", signalIds: [] }, { text: "b", signalIds: ["X9"] }]), registry.all(), []);
    expect(problems.map((p) => p.issue)).toEqual(["cites no signal", "cites unknown signal X9"]);
  });

  it("flags a real artist named in a lyric, whole words only", () => {
    const names = ["Tame Impala", "Teenage Joans", "Pond"];
    const problems = validateSong(song([{ text: "Singing Tame Impala in the car", signalIds: ["T1"] }, { text: "Teenage jeans and a pond", signalIds: ["T1"] }]), registry.all(), names);
    expect(problems).toEqual([{ where: "Verse 1, line 1", issue: "names a real artist (Tame Impala)" }]);
  });
});

describe("dropUnknownIds", () => {
  it("keeps only real ids", () => {
    const fixed = dropUnknownIds(song([{ text: "a", signalIds: ["T1", "X9"] }]), registry.all());
    expect(fixed.sections[0].lines[0].signalIds).toEqual(["T1"]);
  });
});
