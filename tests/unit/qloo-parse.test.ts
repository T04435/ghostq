import { describe, expect, it } from "vitest";
import { isMusicGenre, notonqOf, parseDemographics, parseEntities, parseSearch, parseTags, pickArtist, throughStandIns } from "@/lib/qloo-parse";

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
      { id: "E1", name: "Some Band", popularity: 0.9, affinity: null, spotifyIds: [], musicbrainzId: null, description: null, wikidataId: null, notonq: null, tags: [{ id: "urn:tag:genre:psychedelic", name: "Psychedelic", type: "urn:tag:genre" }] },
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

  it("prefers the Spotify id, then the name", () => {
    const results = parseSearch(json);
    expect(pickArtist(results, "joans", "6i78AQeGl4IGuGePiz3woE")?.id).toBe("B");
    expect(pickArtist(results, "Joans")?.id).toBe("A");
    expect(pickArtist(results, "teenage joans")?.id).toBe("B");
  });

  it("never falls back to an unrelated top result", () => {
    const results = parseSearch({ results: [{ entity_id: "D", name: "Disco Ensemble" }] });
    expect(pickArtist(results, "Zorvex Halloway Ensemble")).toBeUndefined();
    expect(pickArtist(parseSearch({ results: [{ entity_id: "L", name: "Los Aldeanos" }] }), "aldeanos")?.id).toBe("L");
    expect(pickArtist(parseSearch({ results: [{ entity_id: "B", name: "Beyoncé" }] }), "Beyonce")?.id).toBe("B");
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

describe("musicbrainz id", () => {
  it("is read from the search result's external ids", () => {
    const json = { results: [{ entity_id: "A", name: "A", properties: { external: { musicbrainz: { id: "63aa26c3-d59b-4da4-84ac-716b54f1ef4d" } } } }] };
    expect(parseSearch(json)[0].musicbrainzId).toBe("63aa26c3-d59b-4da4-84ac-716b54f1ef4d");
  });
});

describe("NotOnQ records", () => {
  const filled = {
    entity_id: "5e23e428-0000-4000-a000-000000000001",
    name: "Small Act",
    properties: {
      short_description: "Not in Qloo: filled by NotOnQ from open sources. Taste answers (recommendations, maps, audiences) use similar artists Qloo knows: Act A, Act B, Act C. From Leeds, United Kingdom (MusicBrainz). Small Act is an English band.",
      "notonq:home": { name: "Leeds", country: "United Kingdom", country_code: "GB", source: "musicbrainz" },
    },
    tags: [{ name: "Indie Pop", tag_id: "urn:tag:genre:music:indie_pop", type: "urn:tag:genre:music" }],
  };

  it("reads a filled artist's label, similar artists and home", () => {
    const [e] = parseSearch({ results: [filled] });
    expect(e.notonq).toEqual({ kind: "filled", standIns: ["Act A", "Act B", "Act C"], home: { name: "Leeds", country: "United Kingdom", countryCode: "GB" } });
    expect(throughStandIns({ act: e })).toBe(" (through similar artists Qloo knows: Act A, Act B, Act C; via NotOnQ)");
  });

  it("keeps a similar artist's name whole when it has dots of its own", () => {
    const n = notonqOf("Not in Qloo: filled by NotOnQ from open sources. Taste answers use similar artists Qloo knows: A.GIRL, Hope D, Greta Stanley. From Perth, Australia (MusicBrainz).");
    expect(n?.standIns).toEqual(["A.GIRL", "Hope D", "Greta Stanley"]);
  });

  it("tells Qloo's own records NotOnQ chose apart from fills, and leaves Qloo's own alone", () => {
    expect(notonqOf("Picked by NotOnQ: Qloo returned 0 artists for this request; this is Qloo's own record.")?.kind).toBe("picked");
    expect(notonqOf("Matched by NotOnQ: Qloo has this artist but not under this Spotify ID.")?.kind).toBe("matched");
    expect(notonqOf("An American singer-songwriter.")).toBeNull();
    expect(throughStandIns({ act: parseSearch({ results: [{ entity_id: "E2", name: "Known" }] })[0] })).toBe("");
  });
});

describe("NotOnQ's basis on demographics", () => {
  it("reads the genres NotOnQ answered with, when the ages are the similar artists' genre audience", () => {
    const json = { results: { demographics: [{ query: { age: { "25_to_29": 0.7 }, gender: { female: 0.6 } }, "notonq:basis": { stand_ins: ["Act A"], genres: ["urn:tag:genre:music:reggaeton"] } }] } };
    expect(parseDemographics(json)).toEqual({ age: { "25_to_29": 0.7 }, gender: { female: 0.6 }, genres: ["reggaeton"] });
  });

  it("leaves Qloo's own demographics as they are", () => {
    expect(parseDemographics({ results: { demographics: [{ query: { age: { "25_to_29": 0.7 } } }] } })).toEqual({ age: { "25_to_29": 0.7 }, gender: {} });
  });
});

