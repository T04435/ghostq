import { describe, expect, it } from "vitest";
import { voiceFromMusicBrainz } from "@/lib/voice";

describe("voiceFromMusicBrainz", () => {
  it("uses a person's gender", () => {
    expect(voiceFromMusicBrainz({ name: "Tame Impala", type: "Person", gender: "Male" }).voice).toBe("male");
    expect(voiceFromMusicBrainz({ name: "A Singer", type: "Person", gender: "Female" }).voice).toBe("female");
  });

  it("is unknown for a person with no gender", () => {
    expect(voiceFromMusicBrainz({ name: "X", type: "Person", gender: null }).voice).toBeNull();
  });

  it("decides a group from its members", () => {
    const group = { name: "Band", type: "Group", gender: null };
    expect(voiceFromMusicBrainz(group, [{ gender: "Female" }, { gender: "Female" }]).voice).toBe("female");
    expect(voiceFromMusicBrainz(group, [{ gender: "Male" }, { gender: "Female" }]).voice).toBe("duet");
  });

  it("is unknown for a group with no members or a member without gender", () => {
    const group = { name: "Band", type: "Group" };
    expect(voiceFromMusicBrainz(group).voice).toBeNull();
    expect(voiceFromMusicBrainz(group, [{ gender: "Male" }, { gender: null }]).voice).toBeNull();
  });
});
