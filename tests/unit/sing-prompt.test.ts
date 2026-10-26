import { describe, expect, it } from "vitest";
import { buildSingPrompt } from "@/lib/sing-prompt";
import { normalizeSheet, type SongSheet } from "@/lib/song-sheet";

const sheet: SongSheet = {
  title: "Last Tram Home",
  key: "E major",
  tempo: 174,
  feel: "Breathless pop-punk (G4) that slumps into a singalong.",
  genre: "Pop punk (G4) with a garage edge (S1)",
  vocalDirection: "Shouted, double-tracked verses; the whole room joins the chorus (T1)",
  angle: "a",
  artist: "Fictional Band",
  crowd: { from: { place: "qloo", ages: "qloo" }, place: { name: "Melbourne", country: "Australia", countryCode: "AU", lat: -37.81, lon: 144.96 }, placeRank: { rank: 1, of: 10 }, ages: [{ age: "25_to_29", skew: 0.27 }], home: null, language: "English", languageFrom: "city" },
  vocals: { voices: ["male"], source: "test" },
  language: "English",
  productionBrief: "Palm-muted eighths in the verses (G2, G4), a wobble on the lead in the style of A1, and a tram bell in the bridge like M1.",
  warnings: [],
  signals: [
    { id: "A1", kind: "artist", label: "Mac DeMarco", source: "Qloo", value: 0.9 },
    { id: "G2", kind: "genre", label: "Punk", source: "Qloo", value: null },
    { id: "G4", kind: "genre", label: "Pop Punk", source: "Qloo", value: null },
    { id: "S1", kind: "style", label: "Garage Rock", source: "Qloo", value: null },
    { id: "T1", kind: "theme", label: "Friendship", source: "Qloo", value: null },
    { id: "M1", kind: "movie", label: "The Castle", source: "Qloo", value: null },
  ],
  sections: [
    { name: "Verse 1", melody: "m", lines: [{ text: "Shoes in my hand", chords: "E B", signalIds: ["T1"] }, { text: "Texta on my wrist", chords: "C#m A", signalIds: ["T1"] }] },
    { name: "Chorus", melody: "m", lines: [{ text: "Last tram home", chords: "E", signalIds: ["T1"] }, { text: "Hold the doors", chords: "B", signalIds: ["T1"] }] },
  ],
};
const one = { kind: "vocals" as const, voices: ["male" as const], genre: "", direction: "" };

describe("buildSingPrompt", () => {
  const prompt = buildSingPrompt(sheet, one);

  it("tags the sections and keeps the lyrics verbatim", () => {
    expect(prompt).toContain("[Verse 1]\nShoes in my hand\nTexta on my wrist");
    expect(prompt).toContain("[Chorus]\nLast tram home\nHold the doors");
  });

  it("sends the writer's genre and vocal direction, ids as Qloo names", () => {
    expect(prompt).toContain("Genre: Pop punk with a garage edge (Garage Rock).");
    expect(prompt).toContain("Vocals: Shouted, double-tracked verses; the whole room joins the chorus (Friendship)");
    expect(prompt).toContain("Palm-muted eighths in the verses (Punk, Pop Punk)");
  });

  it("never sends an artist, by name or by id", () => {
    expect(prompt).not.toContain("Mac DeMarco");
    expect(prompt).not.toMatch(/\bA1\b/);
    expect(prompt).toContain("a wobble on the lead, and a tram bell");
    expect(prompt).toContain("Key: E major. Tempo: 174 BPM.");
  });

  it("uses what the user edited before singing", () => {
    const edited = buildSingPrompt(sheet, { ...one, genre: "Folk punk", direction: "Spoken, then shouted" });
    expect(edited).toContain("Genre: Folk punk.");
    expect(edited).toContain("Vocals: Spoken, then shouted");
  });

  it("names the voices, and drops the lyrics for an instrumental", () => {
    expect(prompt).toContain("Performed by one male vocalist");
    const instrumental = buildSingPrompt(sheet, { kind: "instrumental", genre: "" });
    expect(instrumental).toContain("instrumental Pop punk with a garage edge (Garage Rock) track of about 3 minutes. No vocals.");
    expect(instrumental).not.toContain("Shoes in my hand");
  });

  it("follows the writer's voice per section, else verses take turns", () => {
    const two = { kind: "vocals" as const, voices: ["male" as const, "male" as const], genre: "", direction: "" };
    const given = buildSingPrompt({ ...sheet, sections: [{ ...sheet.sections[0], voices: "B" }, { ...sheet.sections[1], voices: "A and B" }] }, two);
    expect(given).toContain("[Verse 1 - Voice B]");
    expect(given).toContain("[Chorus - Voices A and B]");
    expect(given).toContain("two different vocalists (Voice A is male, deeper; Voice B is male, higher)");
    const old = buildSingPrompt(sheet, two);
    expect(old).toContain("[Verse 1 - Voice A]");
    expect(old).toContain("[Chorus - Voices A and B together]");
  });

  it("knows section names in Spanish", () => {
    const es = buildSingPrompt(
      { ...sheet, sections: [{ name: "Verso 1", melody: "m", lines: [{ text: "a", chords: "E", signalIds: [] }] }, { name: "Estribillo", melody: "m", lines: [{ text: "b", chords: "E", signalIds: [] }] }] },
      { kind: "vocals", voices: ["male", "female"], genre: "", direction: "" },
    );
    expect(es).toContain("[Verso 1 - Voice A]");
    expect(es).toContain("[Estribillo - Voices A and B together]");
  });
});

describe("normalizeSheet: songs from before 23 Oct", () => {
  it("builds the genre from the saved Qloo tags and the direction from the old rap-or-sung", () => {
    const old: Record<string, unknown> = { ...sheet, vocals: { voices: ["male", "male"], source: "s", delivery: "rap" } };
    delete old.genre;
    delete old.vocalDirection;
    const read = normalizeSheet(old as unknown as SongSheet);
    expect(read.genre).toBe("Punk, Pop Punk, Garage Rock");
    expect(read.vocalDirection).toBe("Rapped");
    expect(read.vocals).toEqual({ voices: ["male", "male"], source: "s" });
  });
});
