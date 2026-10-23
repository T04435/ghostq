import { describe, expect, it } from "vitest";
import { capoFor, chordProblems, chordsIn, fitsKey, parseChord, parseKey, sectionKind, toChordPro, transposeKey, transposeLine } from "@/lib/chords";

const line = (chords: string, text = "a line") => ({ text, chords, signalIds: ["T1"] });

describe("keys and chords", () => {
  it("reads keys and chords with extensions and slash basses", () => {
    expect(parseKey("A minor")).toMatchObject({ tonic: 9, minor: true });
    expect(parseKey("F# major")).toMatchObject({ tonic: 6, minor: false });
    expect(parseKey("Bbm")).toMatchObject({ tonic: 10, minor: true, flats: true });
    expect(parseKey("nonsense")).toBeNull();
    expect(parseChord("F#m7/C#")).toMatchObject({ root: 6, quality: "min" });
    expect(parseChord("Cmaj7")).toMatchObject({ root: 0, quality: "maj" });
    expect(parseChord("Gsus4")).toMatchObject({ root: 7, quality: "other" });
    expect(chordsIn("| Am | F  C  G |").map((c) => c.text)).toEqual(["Am", "F", "C", "G"]);
  });

  it("accepts diatonic and common borrowed chords, and nothing else", () => {
    const c = parseKey("C major")!;
    for (const ch of ["C", "Dm", "Em", "F", "G7", "Am", "Bdim", "Bb", "Ab", "Fm", "Gsus4"]) expect(fitsKey(parseChord(ch)!, c)).toBe(true);
    for (const ch of ["F#", "C#m", "Ebm"]) expect(fitsKey(parseChord(ch)!, c)).toBe(false);
    const am = parseKey("A minor")!;
    for (const ch of ["Am", "C", "Dm", "Em", "E", "F", "G", "D"]) expect(fitsKey(parseChord(ch)!, am)).toBe(true);
  });
});

describe("chordProblems", () => {
  it("flags chords outside the key and a chorus that changes its progression", () => {
    const problems = chordProblems({
      key: "C major",
      sections: [
        { name: "Chorus", melody: "m", lines: [line("C  G  Am  F"), line("C  G  F")] },
        { name: "Verse 1", melody: "m", lines: [line("Am  F#  C")] },
        { name: "Final Chorus", melody: "m", lines: [line("Am  F  C  G"), line("C  G  F")] },
      ],
    });
    expect(problems.map((p) => p.where)).toEqual(["Verse 1, line 1", "Final Chorus"]);
    expect(problems[0].issue).toContain("F#");
  });

  it("passes a clean song", () => {
    expect(chordProblems({ key: "A minor", sections: [{ name: "Verse 1", melody: "m", lines: [line("Am  F  C  G"), line("Am  E")] }] })).toEqual([]);
  });

  it("groups section kinds", () => {
    expect(sectionKind("Verse 2")).toBe("verse");
    expect(sectionKind("Final Chorus")).toBe("chorus");
    expect(sectionKind("Pre-Chorus")).toBe("pre-chorus");
  });
});

describe("transpose, capo, ChordPro", () => {
  it("moves chords and keys, keeping suffixes and spacing", () => {
    expect(transposeLine("Am7/G  F  C", 2)).toBe("Bm7/A  G  D");
    expect(transposeLine("Am  F", -1, true)).toBe("Abm  E");
    expect(transposeKey("A minor", 3)).toBe("C minor");
    expect(transposeKey("G major", 1)).toBe("Ab major");
    expect(transposeKey("D major", 4)).toBe("F# major");
  });

  it("suggests a capo for awkward keys", () => {
    expect(capoFor("Eb major")).toEqual({ fret: 1, shapes: "D major" });
    expect(capoFor("G major")).toBeNull();
    expect(capoFor("F# minor")).toEqual({ fret: 2, shapes: "E minor" });
  });

  it("writes ChordPro with chords spread over the words", () => {
    const cho = toChordPro({ title: "T", key: "A minor", tempo: 90, artist: "Lorde", sections: [{ name: "Verse 1", melody: "m", voices: undefined, lines: [line("Am  F", "up at six the footpath")] }] });
    expect(cho).toContain("{title: T}");
    expect(cho).toContain("{key: A minor}");
    expect(cho).toContain("{comment: Verse 1}");
    expect(cho).toContain("[Am]up at [F]six the footpath");
  });
});
