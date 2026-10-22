import { describe, expect, it } from "vitest";
import { describeVoices, legacyDirection, normalizeVocals, toVocalLine, voicesFromMusicBrainz } from "@/lib/voice";

describe("voicesFromMusicBrainz", () => {
  it("is one voice with a person's gender", () => {
    expect(voicesFromMusicBrainz({ name: "Tame Impala", type: "Person", gender: "Male" }).voices).toEqual(["male"]);
    expect(voicesFromMusicBrainz({ name: "X", type: "Person", gender: null }).voices).toEqual([null]);
  });

  it("is one voice per member for a group, at most three", () => {
    const group = { name: "Los Aldeanos", type: "Group" };
    expect(voicesFromMusicBrainz(group, [{ gender: "Male" }, { gender: "Male" }]).voices).toEqual(["male", "male"]);
    expect(voicesFromMusicBrainz(group, [{ gender: "Male" }, { gender: "Female" }]).voices).toEqual(["male", "female"]);
    const four = voicesFromMusicBrainz(group, [{ gender: "Male" }, { gender: "Male" }, { gender: "Male" }, { gender: "Male" }], false, 4);
    expect(four.voices).toHaveLength(3);
    expect(four.source).toContain("the first 3 of 4");
  });

  it("says when the voices are the lead vocalists", () => {
    expect(voicesFromMusicBrainz({ name: "Arctic Monkeys", type: "Group" }, [{ gender: "Male" }], true).source).toBe("the lead vocalist of Arctic Monkeys on MusicBrainz");
  });

  it("leaves unknowns for the user: no members, or a member without a gender", () => {
    const group = { name: "Band", type: "Group" };
    expect(voicesFromMusicBrainz(group).voices).toEqual([]);
    expect(voicesFromMusicBrainz(group, [{ gender: "Male" }, { gender: null }]).voices).toEqual(["male", null]);
  });
});

describe("describeVoices", () => {
  it("says the voices in words", () => {
    expect(describeVoices({ kind: "vocals", voices: ["female"], genre: "", direction: "" })).toBe("One female voice");
    expect(describeVoices({ kind: "vocals", voices: ["female", "male"], genre: "", direction: "" })).toBe("Two voices: female and male");
    expect(describeVoices({ kind: "instrumental", genre: "" })).toBe("Instrumental, no vocals");
  });
});

describe("songs saved before 23 Oct", () => {
  it("reads the old single voice and the old rap-or-sung", () => {
    expect(normalizeVocals({ voice: "duet", source: "s" }).voices).toEqual(["male", "female"]);
    expect(normalizeVocals({ voice: null, source: "s" }).voices).toEqual([]);
    expect(normalizeVocals({ voices: ["male"], source: "s", delivery: "rap" }).delivery).toBe("rap");
    expect(legacyDirection("rap", [])).toBe("Rapped");
    expect(legacyDirection("both", [])).toBe("Rapped verses and a sung chorus");
    expect(legacyDirection(undefined, ["Indie Pop"])).toBe("Sung");
    expect(legacyDirection(undefined, ["Latin Hip Hop"])).toBe("Rapped");
  });

  it("reads every stored form of the sung vocals", () => {
    expect(toVocalLine("male")).toEqual({ kind: "vocals", voices: ["male"], genre: "", direction: "Sung" });
    expect(toVocalLine("instrumental")).toEqual({ kind: "instrumental", genre: "" });
    expect(toVocalLine(JSON.stringify({ kind: "vocals", voices: ["male", "male"], delivery: "rap" }))).toEqual({ kind: "vocals", voices: ["male", "male"], genre: "", direction: "Rapped" });
    expect(toVocalLine(JSON.stringify({ kind: "vocals", voices: ["female"], genre: "Dream pop", direction: "Breathy" }))?.kind).toBe("vocals");
    expect(toVocalLine("nonsense")).toBeNull();
  });
});
