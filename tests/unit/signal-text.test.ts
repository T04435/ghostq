import { describe, expect, it } from "vitest";
import { idsIn, namesForIds, withoutArtistNames } from "@/lib/signal-text";
import type { Signal } from "@/lib/signals";

// The signals and production brief of The xx song 9tytk1pbcj (bug report, 23 Oct): the genre never reached Lyria.
const s = (id: string, kind: Signal["kind"], label: string): Signal => ({ id, kind, label, source: "Qloo", value: null });
const signals = [
  s("G1", "genre", "Electronic"),
  s("G4", "genre", "Indie"),
  s("S1", "style", "Minimalist Indie Pop"),
  s("S2", "style", "Dream Pop"),
  s("S4", "style", "Alternative R&B"),
  s("T3", "theme", "Introspection"),
  s("T4", "theme", "Loneliness"),
  s("T6", "theme", " longing"),
  s("H1", "audience", "Home Decor"),
  s("A7", "artist", "alt-J"),
  s("A10", "artist", "Metronomy"),
];
const brief =
  "Keep it bare: a clean, reverb-washed guitar playing single notes (G4, S1), a deep round sub bass, and a soft electronic pulse with a muted kick and brushed hi-hat (G1, S4). Two close, breathy voices in call and answer, with a dry, intimate vocal mix that leaves lots of silence (T3, T4). Add a faint dream-pop shimmer in the chorus (S2) and a warm, slightly off-kilter synth pad in the style of A10 and A7. Record the small room sounds, such as a kettle and the tick of a radiator (H1), and let them sit low under the bridge.";

describe("namesForIds", () => {
  const out = namesForIds(brief, signals);

  it("keeps the genre: ids become their Qloo names", () => {
    expect(out).toContain("single notes (Indie, Minimalist Indie Pop)");
    // "electronic pulse" already says Electronic, so only Alternative R&B is added.
    expect(out).toContain("brushed hi-hat (Alternative R&B)");
    expect(out).toContain("shimmer in the chorus (Dream Pop)");
    expect(out).toContain("radiator (Home Decor)");
  });

  it("drops artist references with their phrase, leaving clean text", () => {
    expect(out).toContain("off-kilter synth pad. Record");
    expect(out).not.toMatch(/\b[A-Z]\d+\b/);
    expect(out).not.toContain("style of");
  });

  it("doesn't repeat a name the text already says", () => {
    expect(namesForIds("Minimalist indie pop (S1) over a soft pulse (G1)", signals)).toBe("Minimalist indie pop over a soft pulse (Electronic)");
  });

  it("trims Qloo labels and leaves ids that aren't signals alone", () => {
    expect(namesForIds("a sigh (T6)", signals)).toBe("a sigh (longing)");
    expect(namesForIds("rises to A4 on the hook", signals)).toBe("rises to A4 on the hook");
  });

  it("finds the cited ids", () => {
    expect(idsIn("Dream pop (S2) over a pulse (G1, S4)")).toEqual(["S2", "G1", "S4"]);
  });
});

describe("withoutArtistNames", () => {
  it("removes real artist names", () => {
    expect(withoutArtistNames("Sung softly, like Metronomy.", ["Metronomy", "The xx"])).toBe("Sung softly.");
  });
});

describe("namesForIds with a voice signal", () => {
  it("drops the voice id instead of pasting its whole note", async () => {
    const { namesForIds } = await import("@/lib/signal-text");
    const signals = [
      { id: "V1", kind: "voice" as const, label: "Contralto register with a smoky, restrained timbre", source: "Wikipedia", value: null },
      { id: "S1", kind: "style" as const, label: "Art Pop", source: "Qloo", value: null },
    ];
    expect(namesForIds("Sing it in a smoky contralto (V1), close and layered (S1).", signals)).toBe("Sing it in a smoky contralto, close and layered (Art Pop).");
  });
});
