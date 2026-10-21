import { describe, expect, it } from "vitest";
import { buildSingPrompt } from "@/lib/sing-prompt";
import type { SongSheet } from "@/lib/song-sheet";

const sheet: SongSheet = {
  title: "Last Tram Home",
  key: "E major",
  tempo: 174,
  feel: "Breathless pop-punk (G4) that slumps into a singalong.",
  angle: "a",
  artist: "Fictional Band",
  crowd: { from: { place: "qloo", ages: "qloo" }, place: { name: "Melbourne", country: "Australia", countryCode: "AU", lat: -37.81, lon: 144.96 }, placeRank: { rank: 1, of: 10 }, ages: [{ age: "25_to_29", skew: 0.27 }], home: null, language: "English", languageFrom: "city" },
  vocals: { voices: ["male"], source: "test", delivery: "sung", deliverySource: "test" },
  language: "English",
  productionBrief: "Palm-muted eighths in the verses (G2, G4), a Mac DeMarco wobble on the lead, and a tram bell in the bridge like M1.",
  warnings: [],
  signals: [{ id: "A1", kind: "artist", label: "Mac DeMarco", source: "Qloo", value: 0.9 }],
  sections: [
    { name: "Verse 1", melody: "m", lines: [{ text: "Shoes in my hand", chords: "E B", signalIds: ["T3"] }, { text: "Texta on my wrist", chords: "C#m A", signalIds: ["H6"] }] },
    { name: "Chorus", melody: "m", lines: [{ text: "Last tram home", chords: "E", signalIds: ["T10"] }, { text: "Hold the doors", chords: "B", signalIds: ["T1"] }] },
  ],
};

describe("buildSingPrompt", () => {
  const prompt = buildSingPrompt(sheet, { kind: "vocals", voices: ["male"], delivery: "sung" });

  it("tags the sections and keeps the lyrics verbatim", () => {
    expect(prompt).toContain("[Verse 1]\nShoes in my hand\nTexta on my wrist");
    expect(prompt).toContain("[Chorus]\nLast tram home\nHold the doors");
  });

  it("drops signal ids and real artist names from the style", () => {
    expect(prompt).not.toMatch(/\b[TGM]\d+\b/);
    expect(prompt).not.toContain("Mac DeMarco");
    expect(prompt).toContain("Key: E major. Tempo: 174 BPM.");
  });

  it("names one voice, and drops the lyrics for an instrumental", () => {
    expect(prompt).toContain("performed by a male singer");
    expect(buildSingPrompt(sheet, { kind: "vocals", voices: ["female"], delivery: "rap" })).toContain("performed by a female rapper");
    const instrumental = buildSingPrompt(sheet, { kind: "instrumental" });
    expect(instrumental).toContain("No vocals");
    expect(instrumental).not.toContain("Shoes in my hand");
  });

  it("splits verses between voices and sings the chorus together", () => {
    const two = buildSingPrompt(
      { ...sheet, sections: [...sheet.sections, { name: "Verse 2", melody: "m", lines: [{ text: "Doors close", chords: "E", signalIds: [] }] }, { name: "Bridge", melody: "m", lines: [{ text: "Hum", chords: "A", signalIds: [] }] }] },
      { kind: "vocals", voices: ["male", "male"], delivery: "rap" },
    );
    expect(two).toContain("two different vocalists trading verses: Voice A is a male rapper, deeper and slower; Voice B is a male rapper, higher and faster");
    expect(two).toContain("[Verse 1 - Voice A]");
    expect(two).toContain("[Chorus - Voices A and B together]");
    expect(two).toContain("[Verse 2 - Voice B]");
    expect(two).toContain("[Bridge - Voices A and B, alternating lines]");
  });

  it("knows section names in Spanish", () => {
    const es = buildSingPrompt({ ...sheet, sections: [{ name: "Verso 1", melody: "m", lines: [{ text: "a", chords: "E", signalIds: [] }] }, { name: "Estribillo", melody: "m", lines: [{ text: "b", chords: "E", signalIds: [] }] }] }, { kind: "vocals", voices: ["male", "female"], delivery: "sung" });
    expect(es).toContain("[Verso 1 - Voice A]");
    expect(es).toContain("[Estribillo - Voices A and B together]");
  });
});
