import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SongSheet } from "@/lib/song-sheet";

// The route's collaborators, replaced: the store returns the SAVED sheet, Lyria only records that it was called.
const saved = vi.hoisted(() => ({ sheet: null as unknown }));
const generateSong = vi.hoisted(() => vi.fn(async () => ({ audio: Buffer.from("mp3"), text: "" })));
vi.mock("server-only", () => ({}));
vi.mock("@/server/env", () => ({ providerStatus: () => ({ gemini: true, database: false }), env: {} }));
vi.mock("@/server/lyria", () => ({ generateSong, LyriaError: class extends Error {} }));
// Timing runs after the response (Whisper): here it's only recorded, never called.
const after = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after }));
vi.mock("@/server/lyric-timing", () => ({ timeSung: vi.fn() }));
vi.mock("@/server/limits", () => ({ perVisitor: async () => null, takeLyria: async () => null, refusalResponse: () => new Response(null, { status: 429 }) }));
vi.mock("@/server/store/songs", () => ({
  isSongId: (id: string) => /^[a-z0-9-]{6,48}$/.test(id),
  getSong: async () => ({ id: "abcdef1234", sheet: saved.sheet }),
  saveAudio: async () => {},
  saveTiming: async () => {},
  recordSingBlock: async () => ({ blocks: 1, hidden: false }),
  SING_BLOCKS_TO_HIDE: 3,
}));

const { POST } = await import("@/app/api/sing/route");

const sheet = (lines: string[]): SongSheet =>
  ({
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
    vocals: { voices: ["female"], source: "s" },
    language: "English",
    signals: [{ id: "A1", kind: "artist", label: "Lana Del Rey", source: "Qloo", value: 0.9 }],
    warnings: [],
    sections: [{ name: "Verse 1", melody: "m", lines: lines.map((text) => ({ text, chords: "Am", signalIds: [] })) }],
  }) as unknown as SongSheet;

const vocals = { kind: "vocals", voices: ["female"], genre: "Indie pop", direction: "Sung softly" };
const post = (body: unknown) => POST(new Request("http://x/api/sing", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/sing", () => {
  beforeEach(() => generateSong.mockClear());

  it("sings the saved sheet, never one the client sends (the bypass)", async () => {
    saved.sheet = sheet(["Shoes in my hand", "Last tram home"]);
    const res = await post({ songId: "abcdef1234", vocals, sheet: sheet(["Lorde sings this now"]) });
    expect(res.status).toBe(200);
    expect(generateSong).toHaveBeenCalledOnce();
    const prompt = (generateSong.mock.calls[0] as unknown as [string])[0];
    expect(prompt).toContain("Shoes in my hand");
    expect(prompt).not.toContain("Lorde sings this now");
  });

  it("refuses a saved song whose lyrics name the artist, without calling Lyria", async () => {
    saved.sheet = sheet(["Lorde in the rain"]);
    const res = await post({ songId: "abcdef1234", vocals });
    expect(res.status).toBe(422);
    expect(generateSong).not.toHaveBeenCalled();
  });

  it("refuses an edited vocal direction that names or imitates a singer", async () => {
    saved.sheet = sheet(["Shoes in my hand"]);
    for (const direction of ["Sung like Lana Del Rey", "Make it sound like the singer on the radio", "Imitate her voice"]) {
      const res = await post({ songId: "abcdef1234", vocals: { ...vocals, direction } });
      expect(res.status).toBe(422);
    }
    expect(generateSong).not.toHaveBeenCalled();
  });

  it("needs a saved song's id", async () => {
    const res = await post({ vocals, sheet: sheet(["a"]) });
    expect(res.status).toBe(400);
    expect(generateSong).not.toHaveBeenCalled();
  });
});
