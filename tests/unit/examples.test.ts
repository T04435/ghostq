import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/agent/models", () => ({ MODELS: { agent: "stub" } }));
vi.mock("@/server/store/songs", () => ({ listSongs: async () => [{ artist: "Already Sung" }] }));
const ai = vi.hoisted(() => ({ output: null as unknown, fail: false, finishReason: "stop" }));
vi.mock("ai", async (orig) => ({
  ...(await orig<typeof import("ai")>()),
  generateText: async () => {
    if (ai.fail) throw new Error("model down");
    return { output: ai.output, finishReason: ai.finishReason, usage: { outputTokens: 900 } };
  },
}));
// Spotify has every artist, named exactly as asked, except "Not On Spotify".
vi.mock("@/server/spotify/client", () => ({ searchSpotifyArtists: async (q: string) => (q === "Not On Spotify" ? [] : [{ name: q, id: `sp-${q}` }]) }));
// The suggestion step must never ask NotOnQ (or Qloo): a Write is NotOnQ's first look at a fresh artist.
const qloo = vi.hoisted(() => ({ searchArtist: vi.fn() }));
vi.mock("@/server/qloo/api", () => qloo);

const known = Array.from({ length: 8 }, (_, n) => ({ artist: `Known ${n}`, story: "a small moment", label: "small moment" }));
const moments = [{ story: "first gig in a borrowed van", label: "borrowed van" }];
const releases = (names: string[]) => ({ payload: { releases: names.map((n) => ({ artist_credit_name: n, artist_mbids: ["mbid"] })) } });

let listenBrainz: () => Promise<Response>;
beforeEach(() => {
  ai.fail = false;
  ai.finishReason = "stop";
  ai.output = { examples: known, moments };
  listenBrainz = async () => Response.json(releases(["Fresh Face"]));
  vi.stubGlobal("fetch", vi.fn(() => listenBrainz()));
});
afterEach(() => vi.unstubAllGlobals());

/** The first visit starts the fresh-releases fetch without waiting; the next one, once it's in, can use it. */
async function twoVisits(mode: "solo" | "feat" = "solo") {
  vi.resetModules();
  const { freshExamples } = await import("@/server/examples");
  const first = await freshExamples(mode);
  await new Promise((r) => setTimeout(r, 0));
  return { first, second: await freshExamples(mode) };
}

describe("Ghost suggests", () => {
  it("shows three, one a fresh release once the background fetch is in", async () => {
    const { second } = await twoVisits();
    expect(second).toHaveLength(3);
    expect(second.filter((e) => e.fresh)).toEqual([
      { label: "Fresh Face · borrowed van", brief: { artist: "Fresh Face", spotifyId: "sp-Fresh Face", story: "first gig in a borrowed van" }, fresh: "Fresh Face" },
    ]);
    expect(qloo.searchArtist).not.toHaveBeenCalled();
  });

  it("feat.: the fresh artist is featured with one of the Ghost's artists", async () => {
    ai.output = { examples: known.map((k, n) => ({ ...k, feat: `Partner ${n}` })), moments };
    const { second } = await twoVisits("feat");
    const fresh = second.find((e) => e.fresh);
    expect(fresh?.brief?.feat).toEqual({ artist: "Fresh Face", spotifyId: "sp-Fresh Face" });
    expect(fresh?.brief?.artist).toMatch(/^Known /);
  });

  it("skips artists not on Spotify, already in the Songbook, or in a group credit", async () => {
    listenBrainz = async () =>
      Response.json({ payload: { releases: [...releases(["Not On Spotify", "Already Sung"]).payload.releases, { artist_credit_name: "Duo A & B", artist_mbids: ["a", "b"] }] } });
    const { second } = await twoVisits();
    expect(second).toHaveLength(3);
    expect(second.some((e) => e.fresh)).toBe(false);
  });

  it("drops a brief too long for What's it about? (280 characters)", async () => {
    ai.output = { examples: [{ artist: "Too Long", story: "x".repeat(281), label: "long" }, ...known], moments };
    const { first } = await twoVisits();
    expect(first.some((e) => e.brief?.artist === "Too Long")).toBe(false);
  });

  it("never waits on ListenBrainz: three normal ones while it's down", async () => {
    listenBrainz = async () => {
      throw new Error("ListenBrainz down");
    };
    const { first, second } = await twoVisits();
    expect(first).toHaveLength(3);
    expect(second.some((e) => e.fresh)).toBe(false);
  });

  it("falls back to the fixed ones when the Ghost runs out of room before the JSON closes", async () => {
    ai.finishReason = "length";
    const { first } = await twoVisits();
    expect(first.map((e) => e.brief?.artist).sort()).toEqual(["Natalia Lafourcade", "Radiohead", "Teenage Joans"]);
  });

  it("falls back to the fixed ones when the model fails, and can still add a fresh release", async () => {
    ai.fail = true;
    const { second } = await twoVisits();
    expect(second).toHaveLength(3);
    expect(second.filter((e) => e.fresh)).toHaveLength(1);
  });
});

describe("pickSuggestions", () => {
  it("takes one fresh release, then fills from the rest", async () => {
    const { pickSuggestions } = await import("@/server/examples");
    const fresh = (n: number) => ({ label: `new ${n}`, brief: { artist: `n${n}` }, fresh: `n${n}` });
    const plain = (n: number) => ({ label: `plain ${n}`, brief: { artist: `p${n}` } });
    expect(pickSuggestions([fresh(1), fresh(2), plain(1), plain(2), plain(3)]).filter((e) => e.fresh)).toHaveLength(1);
    expect(pickSuggestions([fresh(1), fresh(2), plain(1)])).toHaveLength(3);
  });
});
