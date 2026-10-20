import { describe, expect, it } from "vitest";
import { isMusicGenre, parseDemographics, parseEntities, parseSearch, parseTags, pickArtist } from "@/lib/qloo-parse";

// Synthetic fixtures in the shapes seen in the day-1 probes. Real Qloo responses stay out of the repo.

describe("parseSearch", () => {
  it("reads entities and their tags", () => {
    const json = {
      results: [
        {
          entity_id: "E1",
          name: "Some Band",
          popularity: 0.9,
          types: ["urn:entity:artist"],
          tags: [{ name: "Psychedelic", tag_id: "urn:tag:genre:psychedelic", type: "urn:tag:genre", value: "urn:tag:genre:psychedelic" }],
        },
      ],
    };
    expect(parseSearch(json)).toEqual([
      { id: "E1", name: "Some Band", popularity: 0.9, affinity: null, spotifyIds: [], tags: [{ id: "urn:tag:genre:psychedelic", name: "Psychedelic", type: "urn:tag:genre" }] },
    ]);
  });

  it("returns nothing for an empty search", () => {
    expect(parseSearch({ results: [] })).toEqual([]);
  });
});

describe("parseEntities", () => {
  it("reads affinity from query", () => {
    const json = {
      success: true,
      results: { entities: [{ entity_id: "E2", name: "Peer", popularity: 0.5, query: { affinity: 0.96, measurements: {} }, tags: [{ id: "urn:tag:genre:music:alt_rock", name: "Alt -rock", type: "urn:tag:genre:music" }] }] },
    };
    const [e] = parseEntities(json);
    expect(e.affinity).toBe(0.96);
    expect(e.tags[0].id).toBe("urn:tag:genre:music:alt_rock");
  });
});

describe("parseTags", () => {
  it("reads insight tags (tag_id) and semantic tags (id)", () => {
    const insight = { results: { tags: [{ tag_id: "urn:tag:theme:qloo:love", name: "Love", popularity: 0.99, query: { affinity: 0.75 } }] } };
    const semantic = { results: { tags: [{ id: "urn:tag:genre:music:bedroom_pop", name: "bedroom pop", popularity: 0.99, tags: [] }] } };
    expect(parseTags(insight)).toEqual([{ id: "urn:tag:theme:qloo:love", name: "Love", affinity: 0.75, popularity: 0.99 }]);
    expect(parseTags(semantic)[0]).toMatchObject({ id: "urn:tag:genre:music:bedroom_pop", affinity: null });
  });
});

describe("parseDemographics", () => {
  it("reads age and gender skews", () => {
    const json = { results: { demographics: [{ entity_id: "E1", query: { age: { "25_to_29": 0.27 }, gender: { female: 0.29, male: -0.29 } } }] } };
    expect(parseDemographics(json)).toEqual({ age: { "25_to_29": 0.27 }, gender: { female: 0.29, male: -0.29 } });
  });

  it("is null for a small act with no data", () => {
    expect(parseDemographics({ results: { demographics: [] } })).toBeNull();
  });
});

describe("isMusicGenre", () => {
  it("drops non-music genre noise", () => {
    expect(isMusicGenre("urn:tag:genre:music:alt_pop")).toBe(true);
    expect(isMusicGenre("urn:tag:genre:drag_race")).toBe(false);
  });
});

describe("tags without a name", () => {
  it("are dropped instead of failing the whole response", () => {
    const json = { results: { entities: [{ entity_id: "E3", name: "X", tags: [{ id: "urn:tag:genre:music:a" }, { id: "urn:tag:genre:music:b", name: "B" }] }] } };
    expect(parseEntities(json)[0].tags).toEqual([{ id: "urn:tag:genre:music:b", name: "B", type: "" }]);
  });
});

describe("pickArtist", () => {
  const json = {
    results: [
      { entity_id: "A", name: "Joans", properties: { external: { spotify: { id: "1111111111111111111111" } } } },
      { entity_id: "B", name: "Teenage Joans", properties: { external: { spotify: { id: "6i78AQeGl4IGuGePiz3woE" } } } },
    ],
  };

  it("prefers the Spotify id, then the exact name, then the top result", () => {
    const results = parseSearch(json);
    expect(pickArtist(results, "joans", "6i78AQeGl4IGuGePiz3woE")?.id).toBe("B");
    expect(pickArtist(results, "Joans")?.id).toBe("A");
    expect(pickArtist(results, "nobody")?.id).toBe("A");
  });
});

describe("spotify ids in odd shapes", () => {
  it("reads objects and lists, and ignores anything else", () => {
    const json = {
      results: [
        { entity_id: "A", name: "A", properties: { external: { spotify: [{ id: "x1" }, { id: "x2" }] } } },
        { entity_id: "B", name: "B", properties: { external: { spotify: { url: "no id here" } } } },
        { entity_id: "C", name: "C", external: { spotify: { id: "x3" } } },
      ],
    };
    expect(parseSearch(json).map((e) => e.spotifyIds)).toEqual([["x1", "x2"], [], ["x3"]]);
  });
});
