import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QlooEntity } from "@/lib/qloo-parse";

vi.mock("server-only", () => ({}));
vi.mock("@/server/agent/models", () => ({ MODELS: { agent: "stub" } }));
vi.mock("@/server/store/songs", () => ({ listSongs: async () => [] }));
const ai = vi.hoisted(() => ({ output: null as unknown, fail: false }));
vi.mock("ai", async (orig) => ({
  ...(await orig<typeof import("ai")>()),
  generateText: async () => {
    if (ai.fail) throw new Error("model down");
    return { output: ai.output };
  },
}));
// Spotify has every suggested artist, named exactly as asked.
vi.mock("@/server/spotify/client", () => ({ searchSpotifyArtists: async (q: string) => [{ name: q, id: `sp-${q}` }] }));
const qloo = vi.hoisted(() => ({ search: (async () => []) as (name: string) => Promise<unknown[]> }));
vi.mock("@/server/qloo/api", () => ({ searchArtist: (name: string) => qloo.search(name) }));

const entity = (name: string, filled: boolean) =>
  ({ id: `id-${name}`, name, spotifyIds: [], tags: [], notonq: filled ? { kind: "filled" } : null }) as unknown as QlooEntity;
const known = Array.from({ length: 8 }, (_, n) => ({ artist: `Known ${n}`, story: "a small moment", label: "small moment" }));

async function examples(mode: "solo" | "feat" = "solo") {
  vi.resetModules();
  const { freshExamples } = await import("@/server/examples");
  return freshExamples(mode);
}

beforeEach(() => {
  ai.fail = false;
  qloo.search = async (name) => [entity(name, name.startsWith("New"))];
});

describe("Ghost suggests", () => {
  it("shows three, one of them new to Qloo when NotOnQ fills a newcomer", async () => {
    ai.output = { examples: known, newcomers: [{ artist: "New Kid", story: "first gig", label: "first gig" }, { artist: "Old Hand", story: "x", label: "x" }] };
    const got = await examples();
    expect(got).toHaveLength(3);
    expect(got.filter((e) => e.newToQloo)).toEqual([expect.objectContaining({ newToQloo: "New Kid", brief: { artist: "New Kid", spotifyId: "sp-New Kid", story: "first gig" } })]);
  });

  it("never labels a newcomer Qloo already knows", async () => {
    ai.output = { examples: known, newcomers: [{ artist: "Old Hand", story: "x", label: "x" }] };
    const got = await examples();
    expect(got).toHaveLength(3);
    expect(got.some((e) => e.newToQloo)).toBe(false);
  });

  it("shows three normal ones when NotOnQ fails", async () => {
    qloo.search = async () => {
      throw new Error("NotOnQ down");
    };
    ai.output = { examples: known, newcomers: [{ artist: "New Kid", story: "x", label: "x" }] };
    const got = await examples();
    expect(got).toHaveLength(3);
    expect(got.some((e) => e.newToQloo)).toBe(false);
  });

  it("doesn't wait on NotOnQ past its time", async () => {
    vi.useFakeTimers();
    qloo.search = () => new Promise(() => {});
    ai.output = { examples: known, newcomers: [{ artist: "New Kid", story: "x", label: "x" }] };
    const pending = examples();
    await vi.advanceTimersByTimeAsync(8_000);
    const got = await pending;
    vi.useRealTimers();
    expect(got).toHaveLength(3);
    expect(got.some((e) => e.newToQloo)).toBe(false);
  });

  it("feat.: the newcomer is the featured artist", async () => {
    const pairs = known.map((k, n) => ({ ...k, feat: `Partner ${n}` }));
    ai.output = { examples: pairs, newcomers: [{ artist: "Known 1", feat: "New Voice", story: "duet", label: "duet" }] };
    const got = await examples("feat");
    expect(got).toHaveLength(3);
    const fresh = got.find((e) => e.newToQloo);
    expect(fresh?.newToQloo).toBe("New Voice");
    expect(fresh?.brief?.feat).toEqual({ artist: "New Voice", spotifyId: "sp-New Voice" });
  });

  it("falls back to three fixed ones, none labelled, when the model fails", async () => {
    ai.fail = true;
    const got = await examples();
    expect(got).toHaveLength(3);
    expect(got.some((e) => e.newToQloo)).toBe(false);
  });
});

describe("pickSuggestions", () => {
  it("takes one new artist, then fills from the rest", async () => {
    const { pickSuggestions } = await import("@/server/examples");
    const fresh = (n: number) => ({ label: `new ${n}`, brief: { artist: `n${n}` }, newToQloo: `n${n}` });
    const plain = (n: number) => ({ label: `plain ${n}`, brief: { artist: `p${n}` } });
    expect(pickSuggestions([fresh(1), fresh(2), plain(1), plain(2), plain(3)]).filter((e) => e.newToQloo)).toHaveLength(1);
    expect(pickSuggestions([fresh(1), fresh(2), plain(1)])).toHaveLength(3);
  });
});
