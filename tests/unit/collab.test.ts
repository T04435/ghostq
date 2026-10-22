import { describe, expect, it } from "vitest";
import { briefSchema } from "@/lib/brief";
import { draftLabel } from "@/lib/draft-label";
import { parseCompare } from "@/lib/qloo-parse";
import { singProblem } from "@/lib/sing-check";
import { SignalRegistry } from "@/lib/signals";
import { sheetToMarkdown, songArtist, type SongSheet } from "@/lib/song-sheet";

// CollabQ ("A feat. B"). Synthetic fixtures in the shape of the 23 Oct compare probe; real Qloo responses stay out of the repo.

describe("parseCompare", () => {
  it("reads shared tags by score and each side's own tags by count", () => {
    const json = {
      results: {
        tags: [
          { tag_id: "urn:tag:theme:qloo:heartbreak", name: " Heartbreak ", subtype: "urn:tag:theme:qloo", query: { score: 0.82 } },
          { tag_id: "urn:tag:style:qloo:moody", name: "Moody", subtype: "urn:tag:style:qloo", query: { score: 0.5 } },
          { name: "No id", subtype: "urn:tag:theme:qloo" },
        ],
        a: [{ tag_id: "urn:tag:theme:qloo:youth", name: "Youth", subtype: "urn:tag:theme:qloo", query: { count: "12" } }],
        b: [{ tag_id: "urn:tag:genre:music:pop", name: "Pop", subtype: "urn:tag:genre:music", query: { count: 4 } }],
        matchEntities: [],
      },
    };
    expect(parseCompare(json)).toEqual({
      shared: [
        { id: "urn:tag:theme:qloo:heartbreak", name: "Heartbreak", kind: "theme", score: 0.82 },
        { id: "urn:tag:style:qloo:moody", name: "Moody", kind: "style", score: 0.5 },
      ],
      onlyA: [{ id: "urn:tag:theme:qloo:youth", name: "Youth", kind: "theme", score: 12 }],
      onlyB: [{ id: "urn:tag:genre:music:pop", name: "Pop", kind: "genre", score: 4 }],
    });
  });

  it("copes with missing lists", () => {
    expect(parseCompare({ results: {} })).toEqual({ shared: [], onlyA: [], onlyB: [] });
  });
});

describe("signal sides", () => {
  it("keeps a side, and makes a label found for both crowds shared", () => {
    const r = new SignalRegistry();
    const a = r.add("theme", "Heartbreak", "Qloo", 0.8, "A");
    const b = r.add("theme", "Road trips", "Qloo", 0.6, "B");
    r.add("theme", "heartbreak", "Qloo", 0.7, "B");
    expect(a.side).toBe("shared");
    expect(b.side).toBe("B");
    expect(r.all()).toHaveLength(2);
  });

  it("adds no side for a solo run", () => {
    expect(new SignalRegistry().add("theme", "Heartbreak", "Qloo", 0.8).side).toBeUndefined();
  });
});

describe("the brief", () => {
  it("takes an optional feat. artist with its own answers", () => {
    const brief = briefSchema.parse({ artist: "Lorde", feat: { artist: "Troye Sivan", answers: { sound: "dreamy synth pop" } } });
    expect(brief.feat).toEqual({ artist: "Troye Sivan", answers: { sound: "dreamy synth pop" } });
    expect(briefSchema.safeParse({ artist: "Lorde", feat: { artist: "" } }).success).toBe(false);
  });
});

const collab = {
  title: "T",
  key: "A minor",
  tempo: 90,
  feel: "f",
  genre: "Indie pop",
  vocalDirection: "Sung softly",
  productionBrief: "p",
  angle: "a",
  artist: "Lorde",
  crowd: {},
  featuring: { artist: "Troye Sivan", crowd: {} },
  vocals: { voices: ["female", "male"], source: "s" },
  language: "English",
  signals: [{ id: "T1", kind: "theme", label: "Heartbreak", source: "Qloo", value: 0.8, side: "shared" }],
  warnings: [],
  sections: [{ name: "Chorus", melody: "m", lines: [{ text: "We drive all night", chords: "Am", signalIds: ["T1"] }] }],
} as unknown as SongSheet;

describe("the CollabQ song", () => {
  it("is labelled A feat. B everywhere", () => {
    expect(songArtist(collab)).toBe("Lorde feat. Troye Sivan");
    expect(songArtist({ artist: "Lorde" })).toBe("Lorde");
    expect(draftLabel("Lorde", "Troye Sivan")).toBe("GhostQ draft for Lorde feat. Troye Sivan, AI-generated, not affiliated with Lorde or Troye Sivan");
    expect(sheetToMarkdown(collab)).toContain("Lorde feat. Troye Sivan");
    expect(sheetToMarkdown(collab)).toContain("- T1: Heartbreak (theme, Qloo, shared, 0.8)");
  });

  it("won't be sung if the lyrics name the featured artist", () => {
    const named = { ...collab, sections: [{ name: "Verse 2", melody: "m", lines: [{ text: "Singing with Troye Sivan tonight", chords: "Am", signalIds: [] }] }] } as SongSheet;
    const vocals = { kind: "vocals", voices: ["female", "male"], genre: "Indie pop", direction: "Sung softly" } as const;
    expect(singProblem(named, vocals as never)).toMatch(/names a real artist/);
    expect(singProblem(collab, vocals as never)).toBeNull();
  });
});
