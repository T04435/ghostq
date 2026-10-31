import { beforeEach, describe, expect, it, vi } from "vitest";
import { briefSchema, remixSchema } from "@/lib/brief";
import { changedLines, lineDiffs, wordDiff } from "@/lib/remix";
import type { SongSheet } from "@/lib/song-sheet";

// RemixQ. Qloo is replaced: the test checks which calls a remix skips, not Qloo's answers.
const qloo = vi.hoisted(() => ({
  artistDemographics: vi.fn(async () => ({ age: { "25_to_29": 0.4 }, gender: {} })),
  fanHeatmap: vi.fn(async () => []),
  zoomedHeatmap: vi.fn(async () => []),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/qloo/api", () => qloo);
const cityAt = vi.hoisted(() => vi.fn(async (): Promise<unknown> => null));
vi.mock("@/server/geocode", () => ({ cityAt }));

const { nextAreas, readCrowd } = await import("@/server/crowd");

const lisbon = { name: "Lisbon", country: "Portugal", countryCode: "PT", lat: 38.72, lon: -9.14 };
const act = { id: "E1", name: "Lorde", popularity: 0.9, affinity: null, spotifyIds: [], musicbrainzId: null, tags: [] };

describe("the remix brief", () => {
  it("needs a city or ages, and a song id", () => {
    expect(remixSchema.safeParse({ of: "angrczhmel", ages: ["24_and_younger"] }).success).toBe(true);
    expect(remixSchema.safeParse({ of: "angrczhmel", place: lisbon }).success).toBe(true);
    expect(remixSchema.safeParse({ of: "angrczhmel" }).success).toBe(false);
    expect(remixSchema.safeParse({ of: "../etc", ages: ["24_and_younger"] }).success).toBe(false);
    expect(briefSchema.parse({ artist: "Lorde", remix: { of: "angrczhmel", ages: ["24_and_younger"] } }).remix?.of).toBe("angrczhmel");
  });
});

describe("readCrowd for a remix", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the picked city and skips the heatmap, keeping Qloo's ages", async () => {
    const { crowd, missing } = await readCrowd(act, undefined, undefined, { place: lisbon });
    expect(qloo.fanHeatmap).not.toHaveBeenCalled();
    expect(qloo.artistDemographics).toHaveBeenCalled();
    expect(crowd.place).toEqual(lisbon);
    expect(crowd.from).toEqual({ place: "remix", ages: "qloo" });
    expect(crowd.placeRank).toBeNull();
    expect(missing).toEqual([]);
  });

  it("uses the picked ages and skips the demographics call", async () => {
    const { crowd } = await readCrowd(act, undefined, undefined, { place: lisbon, ages: ["35_to_44"] });
    expect(qloo.artistDemographics).not.toHaveBeenCalled();
    expect(crowd.ages).toEqual([{ age: "35_to_44", skew: null }]);
    expect(crowd.from).toEqual({ place: "remix", ages: "remix" });
  });
});

const sheet = (sections: [string, string[]][]) => ({ sections: sections.map(([name, lines]) => ({ name, melody: "m", lines: lines.map((text) => ({ text, chords: "Am", signalIds: [] })) })) }) as unknown as SongSheet;

describe("changedLines", () => {
  it("marks lines whose words changed, by section and position", () => {
    const original = sheet([
      ["Verse 1", ["Down the shore road", "Salt on the glass"]],
      ["Chorus", ["Last light, hold on", "Last light"]],
    ]);
    const remix = sheet([
      ["Verse 1", ["Down the Tagus steps", "salt on the glass!"]],
      ["Chorus", ["Last light, hold on", "Last light"]],
      ["Bridge", ["New here"]],
    ]);
    expect([...changedLines(original, remix)]).toEqual(["0:0", "2:0"]);
  });
});

describe("wordDiff and lineDiffs", () => {
  it("keeps the words both lines share, case and punctuation aside, and marks the rest", () => {
    const { before, after } = wordDiff("Mi abuelo se levanta con el gallo", "En Tepoztlán la niebla se va con el Gallo,");
    expect(before.filter((w) => w.changed).map((w) => w.text)).toEqual(["Mi", "abuelo", "levanta"]);
    expect(after.filter((w) => !w.changed).map((w) => w.text)).toEqual(["se", "con", "el", "Gallo,"]);
  });

  it("gives each side its own keys, and a new section only a remix side", () => {
    const original = sheet([
      ["Chorus", ["Last light"]],
      ["Verse 1", ["Down the shore road", "Salt on the glass"]],
    ]);
    const remix = sheet([
      ["Verse 1", ["Down the Tagus steps", "salt on the glass!"]],
      ["Chorus", ["Last light"]],
      ["Bridge", ["New here"]],
    ]);
    const d = lineDiffs(original, remix);
    expect([...d.remix.keys()]).toEqual(["0:0", "2:0"]);
    expect([...d.original.keys()]).toEqual(["1:0"]);
    expect(d.remix.get("2:0")!.every((w) => w.changed)).toBe(true);
  });
});

describe("nextAreas (RemixQ's quick picks)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("names the next heatmap cells, skipping the chosen city, repeats and the sea", async () => {
    const at = (name: string, country = "Portugal") => ({ name, country, countryCode: "PT", lat: 1, lon: 2, settlement: true });
    cityAt.mockResolvedValueOnce(at("Lisbon")).mockResolvedValueOnce(null).mockResolvedValueOnce(at("Porto")).mockResolvedValueOnce(at("Porto")).mockResolvedValueOnce(at("Faro"));
    const rest = ["eyc", "eyd", "eyf", "eyg", "eyu"].map((geohash) => ({ geohash }));
    const got = await nextAreas({ place: { name: "Lisbon", country: "Portugal", countryCode: "PT", lat: 0, lon: 0 }, rest });
    expect(got.map((p) => p.name)).toEqual(["Porto", "Faro"]);
  });

  it("prefers towns over rural districts", async () => {
    const at = (name: string, settlement: boolean) => ({ name, country: "New Zealand", countryCode: "NZ", lat: 1, lon: 2, settlement });
    cityAt.mockResolvedValueOnce(at("Northern Community (Southland)", false)).mockResolvedValueOnce(at("Wellington", true)).mockResolvedValueOnce(at("Dunedin", true));
    const got = await nextAreas({ place: { name: "Auckland", country: "New Zealand", countryCode: "NZ", lat: 0, lon: 0 }, rest: ["rck", "rbs", "rbm"].map((geohash) => ({ geohash })) });
    expect(got.map((p) => p.name)).toEqual(["Wellington", "Dunedin"]);
    expect(got[0]).not.toHaveProperty("settlement");
  });

  it("is empty without an area", async () => {
    expect(await nextAreas(null)).toEqual([]);
  });
});
