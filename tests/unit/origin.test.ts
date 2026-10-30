import { describe, expect, it } from "vitest";
import type { Crowd } from "@/lib/brief";
import { backfillOrigins, NOTONQ_SINCE } from "@/lib/origin-backfill";
import type { RunEvent } from "@/lib/run-events";
import { originOf, SignalRegistry, type Signal } from "@/lib/signals";
import type { SongSheet } from "@/lib/song-sheet";

describe("signal origin", () => {
  it("is set where the signal is made, and a repeat keeps the first", () => {
    const r = new SignalRegistry();
    expect(r.add("genre", "Pop", "notonq", "NotOnQ: genres from open data, as Qloo's own tags", null).origin).toBe("notonq");
    expect(r.add("genre", "pop", "qloo", "Qloo", null).origin).toBe("notonq");
    expect(r.add("theme", "Love", "qloo", "Qloo insights", 0.7).origin).toBe("qloo");
  });

  it("is never read from the source text: a signal without one is other", () => {
    expect(originOf({})).toBe("other");
    expect(originOf({ origin: "qloo" })).toBe("qloo");
  });
});

const sig = (id: string, kind: Signal["kind"], label: string, source = "anything, even Qloo's name"): Signal => ({ id, kind, label, source, value: null });
const crowd = (over: Partial<Crowd> = {}): Crowd =>
  ({
    from: { place: "qloo", ages: "qloo" },
    place: { name: "New York", country: "United States", countryCode: "US", lat: 0, lon: 0 },
    ages: [{ age: "30_to_34", skew: 0.12 }],
    language: "English",
    languageFrom: "releases",
    ...over,
  }) as Crowd;
const sheet = (signals: Signal[], c: Crowd) => ({ title: "T", artist: "A", crowd: c, signals, sections: [] }) as unknown as SongSheet;
const step = (id: string, tool: string, signals: Signal[], raw?: unknown): RunEvent[] => [
  { type: "step-start", id, tool, label: tool, input: {} },
  { type: "step-end", id, ok: true, summary: "", signals, raw },
];

describe("backfill of saved songs", () => {
  // Six Foot Blonde, "Hold Me, Hold Music" (cdde7tapnw, 30 Oct): NotOnQ filled the artist (its similar artists are saved
  // in the crowd), so its own genres are NotOnQ's; the crowd and themes are Qloo's answers through those artists.
  it("cdde7tapnw: G1–G3 and the home are NotOnQ's, the crowd and themes Qloo's", () => {
    const c = crowd({ home: { name: "Bloomington", country: "United States", countryCode: "US", source: "notonq" }, standIns: ["Honey Butter", "Claire Ernst"] });
    const G = [sig("G1", "genre", "Pop"), sig("G2", "genre", "Indie - Rock"), sig("G3", "genre", "r&b")];
    const crowdSignals = [sig("O1", "home", "Bloomington, United States"), sig("C1", "crowd", "Crowd around New York"), sig("C2", "crowd", "Crowd aged 30–34")];
    const T = [sig("T1", "theme", "Identity"), sig("T2", "theme", "Love")];
    const research: RunEvent[] = [...step("find-artist", "find_artist", G), { type: "crowd", artist: "Six Foot Blonde", crowd: c }, ...step("read-crowd", "read_crowd", crowdSignals), ...step("call_1", "crowd_tags", T)];
    const r = backfillOrigins({ createdAt: "2026-10-30T12:30:00Z", sheet: sheet([...G, ...crowdSignals, ...T], c), research });
    expect(Object.fromEntries(r.sheet.signals.map((s) => [s.id, s.origin]))).toEqual({ G1: "notonq", G2: "notonq", G3: "notonq", O1: "notonq", C1: "qloo", C2: "qloo", T1: "qloo", T2: "qloo" });
    expect(r.unknown).toEqual([]);
  });

  it("a Qloo record: each saved tag says whose it is (NotOnQ's flag on a genre it added)", () => {
    const G = [sig("G1", "genre", "Rock"), sig("G2", "genre", "Emo")];
    const raw = { name: "X", popularity: 0.5, tags: [{ name: "Rock" }, { name: "Emo", notonq: true }] };
    const r = backfillOrigins({ createdAt: "2026-10-31T00:00:00Z", sheet: sheet(G, crowd()), research: step("find-artist", "find_artist", G, raw) });
    expect(r.sheet.signals.map((s) => s.origin)).toEqual(["qloo", "notonq"]);
  });

  it("a song from before NotOnQ is Qloo's; after it, an artist step with nothing saved is other, and listed", () => {
    const G = [sig("G1", "genre", "Rock")];
    const before = backfillOrigins({ createdAt: "2026-10-22T00:00:00Z", sheet: sheet(G, crowd()), research: step("find-artist", "find_artist", G) });
    expect(before.sheet.signals[0].origin).toBe("qloo");
    const after = backfillOrigins({ createdAt: "2026-10-31T00:00:00Z", sheet: sheet(G, crowd()), research: step("find-artist", "find_artist", G) });
    expect(after.sheet.signals[0].origin).toBe("other");
    expect(after.unknown).toEqual(["G1"]);
    expect(NOTONQ_SINCE < "2026-10-31").toBe(true);
  });

  it("your answers, Wikipedia's voice and a MusicBrainz home are other; Qloo's tools are Qloo's", () => {
    const c = crowd({ from: { place: "you", ages: "qloo" }, home: { name: "Auckland", country: "New Zealand", countryCode: "NZ", source: "musicbrainz" } });
    const crowdSignals = [sig("O1", "home", "Auckland"), sig("C1", "crowd", "Crowd around Lisboa"), sig("C2", "crowd", "Crowd aged 25–29")];
    const V = [sig("V1", "voice", "Contralto")];
    const M = [sig("M1", "movie", "Little Women")];
    const research: RunEvent[] = [{ type: "crowd", artist: "Lorde", crowd: c }, ...step("read-crowd", "read_crowd", crowdSignals), ...step("vocal-style", "vocal_style", V), ...step("call_2", "crowd_taste", M)];
    const r = backfillOrigins({ createdAt: "2026-10-25T00:00:00Z", sheet: sheet([...crowdSignals, ...V, ...M], c), research });
    expect(r.sheet.signals.map((s) => [s.id, s.origin])).toEqual([["O1", "other"], ["C1", "other"], ["C2", "qloo"], ["V1", "other"], ["M1", "qloo"]]);
  });

  it("keeps an origin a signal already has", () => {
    const G = [{ ...sig("G1", "genre", "Rock"), origin: "notonq" as const }];
    const r = backfillOrigins({ createdAt: "2026-10-22T00:00:00Z", sheet: sheet(G, crowd()), research: step("find-artist", "find_artist", G) });
    expect(r.sheet.signals[0].origin).toBe("notonq");
  });
});
