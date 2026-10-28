import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/env", () => ({ env: { QLOO_API_KEY: "k", QLOO_API_BASE_URL: "http://notonq.test/q/app/ghostq", QLOO_DIRECT_BASE_URL: "http://qloo.test" } }));

// Qloo's harness, faked: synthetic results in its envelope (real Qloo responses stay out of the repo).
const calls: { name: string; input: unknown }[] = [];
let envSeen: Record<string, string | undefined> = {};
const bases: string[] = [];
let notonqDown = false;
const envelope = (name: string, input: Record<string, unknown>) => {
  if (input.entity === "BAD") return { status: "error", summary: "Qloo rejected the request", error: { code: "QLOO_CONTRACT" }, results: [] };
  if (name === "qloo_audience_demographics") return { status: "ok", results: [{ entity_id: "S1", query: { age: { "25_to_29": 0.4 }, gender: { female: 0.2 } } }] };
  return { status: "ok", results: [{ entity_id: "E1", name: "Act One", popularity: 0.9, affinity: 0.8, properties: { description: "A band." } }] };
};
vi.mock("@qloo/qloo-harness", () => ({
  createQlooToolsFromEnvironment: ({ env }: { env: Record<string, string | undefined> }) => {
    if (env.QLOO_BASE_URL?.includes("notonq")) envSeen = env;
    return ["qloo_recommend", "qloo_audience_demographics"].map((name) => ({
      name,
      execute: async (_id: string, input: Record<string, unknown>) => {
        bases.push(env.QLOO_BASE_URL!);
        if (notonqDown && env.QLOO_BASE_URL?.includes("notonq")) throw new TypeError("fetch failed");
        calls.push({ name, input });
        return { details: envelope(name, input) };
      },
    }));
  },
}));

const api = await import("@/server/qloo/api");
const { harness } = await import("@/server/qloo/harness");

describe("Qloo calls through the harness", () => {
  beforeEach(() => {
    calls.length = 0;
    bases.length = 0;
    notonqDown = false;
  });

  it("points the harness at GhostQ's own base URL (NotOnQ) and trusts only that URL with the key", async () => {
    await api.soundAlikes("A1");
    expect(envSeen).toMatchObject({ QLOO_API_KEY: "k", QLOO_BASE_URL: "http://notonq.test/q/app/ghostq", QLOO_TRUSTED_BASE_URL: "http://notonq.test/q/app/ghostq" });
  });

  it("sends the same requests GhostQ made directly, and reads the answers with GhostQ's own parsers", async () => {
    const logs: { path: string; cached: boolean }[] = [];
    const alikes = await api.soundAlikes("A2", (l) => logs.push(l));
    expect(alikes).toEqual([expect.objectContaining({ id: "E1", name: "Act One", affinity: 0.8, popularity: 0.9 })]);
    await api.artistsByTags(["urn:tag:genre:music:indie_pop"]);
    const demo = await api.artistDemographics("A2");
    expect(demo).toEqual({ age: { "25_to_29": 0.4 }, gender: { female: 0.2 } });
    expect(calls).toEqual([
      { name: "qloo_recommend", input: { target_type: "artist", signals: ["A2"], limit: 10 } },
      { name: "qloo_recommend", input: { target_type: "artist", signal_tags: ["urn:tag:genre:music:indie_pop"], signal_tags_operator: "intersection", limit: 10 } },
      { name: "qloo_audience_demographics", input: { entity: "A2", entity_type: "artist" } },
    ]);
    expect(logs).toEqual([expect.objectContaining({ path: "harness:qloo_recommend", cached: false })]);
  });

  it("caches a call for the run's budget, logging the repeat as cached", async () => {
    const logs: { cached: boolean }[] = [];
    await api.soundAlikes("A3", (l) => logs.push(l));
    await api.soundAlikes("A3", (l) => logs.push(l));
    expect(calls).toHaveLength(1);
    expect(logs.map((l) => l.cached)).toEqual([false, true]);
  });

  it("turns a rejected request into the 400 GhostQ reads as 'not usable as a signal'", async () => {
    await expect(harness("qloo_audience_demographics", { entity: "BAD", entity_type: "artist" })).rejects.toMatchObject({ name: "QlooError", status: 400 });
  });

  it("goes straight to Qloo, with the same key, when NotOnQ doesn't answer", async () => {
    notonqDown = true;
    const alikes = await api.soundAlikes("A4");
    expect(alikes).toEqual([expect.objectContaining({ id: "E1" })]);
    expect(bases).toEqual(["http://notonq.test/q/app/ghostq", "http://qloo.test"]);
  });

  it("passes Qloo's own refusals on, without asking Qloo again", async () => {
    await expect(harness("qloo_audience_demographics", { entity: "BAD", entity_type: "artist" })).rejects.toMatchObject({ status: 400 });
    expect(bases).toEqual(["http://notonq.test/q/app/ghostq"]);
  });
});
