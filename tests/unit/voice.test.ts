import { describe, expect, it } from "vitest";
import { deliveryFromTags, describeVocalLine, normalizeVocals, toVocalLine, voicesFromMusicBrainz } from "@/lib/voice";

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

describe("deliveryFromTags", () => {
  it("reads rap, sung or both from Qloo's tags", () => {
    expect(deliveryFromTags(["Hip - Hop", "Cuba", "Rap", "Latin Hip Hop"], "Los Aldeanos").delivery).toBe("rap");
    expect(deliveryFromTags(["Indie Rock", "Pop Punk"], "X").delivery).toBe("sung");
    expect(deliveryFromTags(["Reggaeton", "Latin Hip Hop"], "X").delivery).toBe("both");
    expect(deliveryFromTags(["Pop Rap"], "X").delivery).toBe("rap");
    expect(deliveryFromTags([], "X")).toEqual({ delivery: "sung", deliverySource: "Qloo has no genres for X" });
    expect(deliveryFromTags(["Ambient"], "X")).toEqual({ delivery: "sung", deliverySource: "Qloo's tags for X (no rap)" });
  });
});

describe("describeVocalLine", () => {
  it("says the line in words", () => {
    expect(describeVocalLine({ kind: "vocals", voices: ["male", "male"], delivery: "rap" })).toBe("Two male rappers, trading verses");
    expect(describeVocalLine({ kind: "vocals", voices: ["female"], delivery: "sung" })).toBe("One female singer");
    expect(describeVocalLine({ kind: "vocals", voices: ["female", "male", "female"], delivery: "sung" })).toBe("Three singers (one male, two female), trading verses");
    expect(describeVocalLine({ kind: "instrumental" })).toBe("Instrumental, no vocals");
  });
});

describe("songs saved before 22 Oct", () => {
  it("reads the old single voice", () => {
    expect(normalizeVocals({ voice: "duet", source: "s" }).voices).toEqual(["male", "female"]);
    expect(normalizeVocals({ voice: null, source: "s" }).voices).toEqual([]);
    const lorde = normalizeVocals({ voice: "female", source: "s" }, { artist: "Lorde", signals: [{ kind: "genre", label: "Indie Pop" }, { kind: "theme", label: "Youth" }] });
    expect(lorde).toMatchObject({ voices: ["female"], delivery: "sung", deliverySource: "Qloo's tags for Lorde: Indie Pop" });
    expect(normalizeVocals({ voice: "male", source: "s" }, { artist: "X", signals: [{ kind: "genre", label: "Rap" }] }).delivery).toBe("rap");
    expect(toVocalLine("male")).toEqual({ kind: "vocals", voices: ["male"], delivery: "sung" });
    expect(toVocalLine("instrumental")).toEqual({ kind: "instrumental" });
    expect(toVocalLine(JSON.stringify({ kind: "vocals", voices: ["male", "male"], delivery: "rap" }))?.kind).toBe("vocals");
    expect(toVocalLine("nonsense")).toBeNull();
  });
});
