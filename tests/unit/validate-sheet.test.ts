import { describe, expect, it } from "vitest";
import { SignalRegistry } from "@/lib/signals";
import type { WrittenSong } from "@/lib/song-sheet";
import { dropUnknownIds, validateSong } from "@/lib/validate-sheet";

const registry = new SignalRegistry();
const love = registry.add("theme", "Love", "qloo", "Qloo insights", 0.75);
const film = registry.add("movie", "Little Women", "qloo", "Qloo insights", 0.8);
registry.add("theme", "love", "qloo", "Qloo insights", 0.7); // same label: no new signal

function song(lines: { text: string; signalIds: string[] }[]): WrittenSong {
  return {
    title: "T",
    key: "A minor",
    tempo: 96,
    feel: "f",
    genre: "Indie pop (T1)",
    vocalDirection: "Sung softly (T1)",
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

describe("film and book titles", () => {
  it("flags a title from the signals in a lyric, but not a short one-word title", () => {
    const r = new SignalRegistry();
    r.add("theme", "Love", "qloo", "Qloo", 0.7);
    r.add("movie", "Little Women", "qloo", "Qloo", 0.9);
    r.add("movie", "Up", "qloo", "Qloo", 0.8);
    const problems = validateSong(song([{ text: "Like little women on the stairs", signalIds: ["T1"] }, { text: "We go up the hill", signalIds: ["T1"] }]), r.all(), []);
    expect(problems.map((p) => p.issue)).toEqual(["names a film or book (Little Women); use its mood, not its title"]);
  });
});

describe("dropUnknownIds", () => {
  it("keeps only real ids", () => {
    const fixed = dropUnknownIds(song([{ text: "a", signalIds: ["T1", "X9"] }]), registry.all());
    expect(fixed.sections[0].lines[0].signalIds).toEqual(["T1"]);
  });
});

describe("genre and vocal direction", () => {
  const r = new SignalRegistry();
  const pop = r.add("style", "Minimalist Indie Pop", "qloo", "Qloo", null);
  const muse = r.add("artist", "Lana Del Rey", "qloo", "Qloo", 0.9);
  const base = song([{ text: "a", signalIds: [pop.id] }]);
  const check = (genre: string, vocalDirection: string) => validateSong({ ...base, genre, vocalDirection }, r.all(), ["Lana Del Rey"]).map((p) => `${p.where}: ${p.issue}`);

  it("passes real receipts", () => {
    expect(check(`Minimalist indie pop (${pop.id})`, `Breathy, close-mic'd (${pop.id})`)).toEqual([]);
  });

  it("needs a receipt, and never an artist by id or by name", () => {
    expect(check("Indie pop", `Sung (${pop.id})`)).toEqual(["Genre: cites no signal"]);
    expect(check(`Pop (${muse.id})`, `Sung (${pop.id})`)).toEqual([`Genre: cites an artist (${muse.id}); use genre and style signals`]);
    expect(check(`Pop (${pop.id})`, `Sung like Lana Del Rey (${pop.id})`)).toEqual(["Vocal direction: names a real artist (Lana Del Rey)"]);
    expect(check(`Pop (${pop.id})`, "")).toEqual(["Vocal direction: is empty"]);
  });
});
