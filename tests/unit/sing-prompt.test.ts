import { describe, expect, it } from "vitest";
import { buildSingPrompt } from "@/lib/sing-prompt";
import type { SongSheet } from "@/lib/song-sheet";

const sheet: SongSheet = {
  title: "Last Tram Home",
  key: "E major",
  tempo: 174,
  feel: "Breathless pop-punk (G4) that slumps into a singalong.",
  angle: "a",
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
  const prompt = buildSingPrompt(sheet);

  it("tags the sections and keeps the lyrics verbatim", () => {
    expect(prompt).toContain("[Verse 1]\nShoes in my hand\nTexta on my wrist");
    expect(prompt).toContain("[Chorus]\nLast tram home\nHold the doors");
  });

  it("drops signal ids and real artist names from the style", () => {
    expect(prompt).not.toMatch(/\b[TGM]\d+\b/);
    expect(prompt).not.toContain("Mac DeMarco");
    expect(prompt).toContain("Key: E major. Tempo: 174 BPM.");
  });
});
