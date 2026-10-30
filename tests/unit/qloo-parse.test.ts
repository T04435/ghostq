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
      { id: "E1", name: "Some Band", popularity: 0.9, affinity: null, spotifyIds: [], musicbrainzId: null, description: null, wikidataId: null, notonq: null, gaps: null, tags: [{ id: "urn:tag:genre:psychedelic", name: "Psychedelic", type: "urn:tag:genre" }] },
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

describe("NotOnQ records (keyed blocks, structured only)", () => {
  const id = "5e23e428-0000-4000-a000-000000000001";
  // The description is written to mislead: the parser must never read it.
  const filled = {
    entity_id: id,
    name: "Small Act",
    properties: {
      short_description: "Picked by NotOnQ: says the text, which is never read.",
      "notonq:home": { name: "Leeds", country: "United Kingdom", country_code: "GB", source: "musicbrainz" },
    },
    tags: [{ name: "Indie Pop", tag_id: "urn:tag:genre:music:indie_pop", type: "urn:tag:genre:music" }],
  };
  const block = (kind: string, standIns: string[] = []) => ({ served_by: "fallback", kind, proxy: { replaced: [], stand_ins: standIns.map((name, i) => ({ entity_id: `S${i}`, name, weight: 1, source: "lastfm" })) } });

  it("reads a fill, its similar artists and its home from the block keyed by its id", () => {
    const [e] = parseSearch({ results: [filled], notonq: { served_by: "mixed", [id]: block("filled", ["Act A", "A.GIRL", "Act C"]) } });
    expect(e.notonq).toEqual({ kind: "filled", standIns: ["Act A", "A.GIRL", "Act C"], home: { name: "Leeds", country: "United Kingdom", countryCode: "GB" } });
    expect(throughStandIns({ act: e })).toBe(" (through similar artists Qloo knows: Act A, A.GIRL, Act C; via NotOnQ)");
  });

  it("reads the record's own list of similar artists first, when it sends one", () => {
    const withList = { ...filled, properties: { ...filled.properties, "notonq:standIns": [{ entity_id: "E1", name: "Hope D" }, { entity_id: "E2", name: "Greta Stanley" }] } };
    expect(parseSearch({ results: [withList], notonq: { served_by: "mixed", [id]: block("filled", ["Other"]) } })[0].notonq?.standIns).toEqual(["Hope D", "Greta Stanley"]);
  });

  it("reads picked, matched and candidate the same way, and only for the keyed record", () => {
    const q = { entity_id: "Q1", name: "Qloo's own", tags: [] };
    const json = (kind: string) => ({ results: [q, filled], notonq: { served_by: "mixed", [id]: block(kind) } });
    for (const kind of ["picked", "matched", "candidate"]) {
      const [own, ours] = parseSearch(json(kind));
      expect(ours.notonq?.kind).toBe(kind);
      expect(own.notonq).toBeNull();
    }
    expect(parseEntities({ results: { entities: [filled] }, notonq: { served_by: "fallback", [id]: block("filled") } })[0].notonq?.kind).toBe("filled");
  });

  it("an answer Qloo gave as it is (or no notonq at all) is Qloo's: no kind", () => {
    expect(parseSearch({ results: [filled], notonq: { served_by: "qloo", attribution: [] } })[0].notonq).toBeNull();
    expect(parseSearch({ results: [filled] })[0].notonq).toBeNull();
    expect(throughStandIns({ act: parseSearch({ results: [{ entity_id: "E2", name: "Known" }] })[0] })).toBe("");
  });

  it("an older NotOnQ answer with no keyed blocks is unknown for every record, never a guess from the text", () => {
    const flat = { results: [{ entity_id: "Q1", name: "Qloo's own", tags: [] }, filled], notonq: { served_by: "mixed", gap: { kind: "missing" }, proxy: { replaced: [], stand_ins: [] } } };
    expect(parseSearch(flat).map((e) => e.notonq?.kind)).toEqual(["unknown", "unknown"]);
    expect(notonqOf({ served_by: "mixed" }, "X")?.kind).toBe("unknown");
    expect(notonqOf({ served_by: "mixed", [id]: { kind: "made-up" } }, id)?.kind).toBe("unknown");
  });
});

describe("NotOnQ's keyed blocks, its real shape (feat/keyed-notonq-blocks, 31 Oct)", () => {
  const SFB = "221af8ba-bce4-48f1-a19b-d9562274dc0f";
  const qloo = [{ entity_id: "Q-BR", name: "Blonde Redhead" }, { entity_id: "Q-YM", name: "You Me at Six" }, { entity_id: "Q-TF", name: "Thousand Foot Krutch" }];
  const standIns = [{ entity_id: "Q-HB", name: "Honey Butter", weight: 0.93, source: "lastfm" }, { entity_id: "Q-CE", name: "Claire Ernst", weight: 0.9, source: "lastfm" }];
  const fillBlock = { kind: "filled", served_by: "fallback", gap: { kind: "G1", qloo_status: 200 }, proxy: { replaced: [], stand_ins: standIns } };

  it("Example 1: the fill is keyed by its id; the flat gap's kind is not a block", () => {
    const json = {
      results: [...qloo, { entity_id: SFB, name: "Six Foot Blonde", properties: { "notonq:standIns": standIns } }],
      notonq: { served_by: "mixed", gap: { kind: "G1", qloo_status: 200 }, proxy: { replaced: [], stand_ins: standIns }, [SFB]: fillBlock },
    };
    const all = parseSearch(json);
    expect(all.map((e) => e.notonq?.kind ?? null)).toEqual([null, null, null, "filled"]);
    expect(all[3].notonq?.standIns).toEqual(["Honey Butter", "Claire Ernst"]);
    expect(pickArtist(all, "Six Foot Blonde")?.id).toBe(SFB);
  });

  it("Example 2: candidates keyed beside the fill; one never picked on its own", () => {
    const json = {
      results: [...qloo, { entity_id: SFB, name: "Six Foot Blonde" }, { entity_id: "a68731a4", name: "6 foot 4" }, { entity_id: "39053243", name: "6 Foot 7 Foot" }],
      notonq: {
        served_by: "needs_choice",
        gap: { kind: "G1", qloo_status: 200 },
        candidates: [{ key: "mb:x", name: "Six Foot Blonde", entity_id: SFB }],
        [SFB]: fillBlock,
        a68731a4: { kind: "candidate", key: "lf:6-foot-4", name: "6 foot 4", next: "Send this entity_id to /entities." },
        "39053243": { kind: "candidate", key: "lf:6-foot-7-foot", name: "6 Foot 7 Foot", next: "…" },
      },
    };
    const all = parseSearch(json);
    expect(all.map((e) => e.notonq?.kind ?? null)).toEqual([null, null, null, "filled", "candidate", "candidate"]);
    expect(pickArtist(all, "6 foot 4")).toBeUndefined();
  });

  it("picked and matched blocks mark Qloo's own records", () => {
    const json = { results: qloo, notonq: { served_by: "mixed", "Q-BR": { kind: "matched", query: "Blonde Redhead", note: "…" }, "Q-YM": { kind: "picked", ranked_by_qloo: true } } };
    expect(parseSearch(json).map((e) => e.notonq?.kind ?? null)).toEqual(["matched", "picked", null]);
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


describe("NotOnQ field gaps on thin Qloo records (v0.6.0)", () => {
  const thin = {
    entity_id: "T1",
    name: "Thin Act",
    properties: {
      short_description: "A Japanese band.",
      external: { "notonq:wikidata": [{ id: "q42" }], "notonq:musicbrainz": [{ id: "mb-1" }] },
      "notonq:home": { name: "Tokyo", country: "Japan", country_code: "JP", source: "musicbrainz" },
      "notonq:languages": [
        { code: "jpn", name: "Japanese", releases: 9 },
        { code: "eng", name: "English", releases: 2 },
      ],
    },
    tags: [{ tag_id: "notonq:urn:tag:genre:music:mathcore", name: "Mathcore" }],
  };

  it("reads NotOnQ's home, languages, ids and genres, and marks them", () => {
    const [e] = parseSearch({ results: [thin] });
    expect(e.notonq).toBeNull();
    expect(e.gaps).toEqual({ home: { name: "Tokyo", country: "Japan", countryCode: "JP" }, languages: ["Japanese", "English"], musicbrainzId: true, wikidataId: true });
    expect(e.wikidataId).toBe("Q42");
    expect(e.musicbrainzId).toBe("mb-1");
    expect(e.tags).toEqual([{ id: "urn:tag:genre:music:mathcore", name: "Mathcore", type: "urn:tag:genre:music", notonq: true }]);
  });

  it("keeps Qloo's own ids over NotOnQ's", () => {
    const [e] = parseSearch({ results: [{ ...thin, properties: { ...thin.properties, external: { ...thin.properties.external, wikidata: [{ id: "q1" }], musicbrainz: [{ id: "mb-q" }] } } }] });
    expect(e.wikidataId).toBe("Q1");
    expect(e.musicbrainzId).toBe("mb-q");
    expect(e.gaps).toMatchObject({ musicbrainzId: false, wikidataId: false });
  });

  it("has no gaps when NotOnQ added nothing", () => {
    const [e] = parseSearch({ results: [{ entity_id: "Q", name: "Full", tags: [] }] });
    expect(e.gaps).toBeNull();
  });

  it("reads the genres behind a genre-audience answer", () => {
    const d = parseDemographics({ results: { demographics: [{ query: { age: { "35_and_younger": 0.2 } }, "notonq:basis": { stand_ins: [], genres: ["urn:tag:genre:music:mathcore"] } }] } });
    expect(d?.genres).toEqual(["mathcore"]);
  });
});

describe("pickArtist: the exact name over a near match", () => {
  const e = (id: string, name: string) => ({ id, name, popularity: null, affinity: null, tags: [], spotifyIds: [], musicbrainzId: null });
  it("takes NotOnQ's ANORAK! over Qloo's Anorak", () => {
    expect(pickArtist([e("Q", "Anorak"), e("N", "ANORAK!")], "ANORAK!")?.id).toBe("N");
  });
  it("still takes Qloo's entry when it's the only one by that name", () => {
    expect(pickArtist([e("Q", "Anorak")], "ANORAK!")?.id).toBe("Q");
  });
});

describe("NotOnQ candidates", () => {
  const cand = { entity_id: "C1", name: "ANORAK!", properties: { short_description: "Not in Qloo: a possible match from open data." }, tags: [] };
  const json = { results: [cand], notonq: { served_by: "needs_choice", C1: { kind: "candidate" } } };
  it("reads them as candidates, not fills", () => {
    expect(parseSearch(json)[0].notonq?.kind).toBe("candidate");
  });
  it("never picks one on its own", () => {
    expect(pickArtist(parseSearch(json), "ANORAK!")).toBeUndefined();
  });
});
