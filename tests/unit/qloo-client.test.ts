import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/env", () => ({ env: { QLOO_API_KEY: "k", QLOO_API_BASE_URL: "http://notonq.test/q/app/ghostq", QLOO_DIRECT_BASE_URL: "http://qloo.test" } }));

const { qlooGet } = await import("@/server/qloo/client");

/** A fake fetch: NotOnQ answers with `notonq` (a status, or "down" for no answer); Qloo answers 200. */
function fakeFetch(notonq: number | "down") {
  const urls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    urls.push(url);
    if (url.startsWith("http://notonq.test")) {
      if (notonq === "down") throw new TypeError("fetch failed");
      if (notonq !== 200) return new Response("nope", { status: notonq });
      return Response.json({ from: "notonq" });
    }
    return Response.json({ from: "qloo" });
  });
  return urls;
}

describe("Qloo calls when NotOnQ fails", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("goes through NotOnQ when it answers", async () => {
    const urls = fakeFetch(200);
    await expect(qlooGet("/search", { query: "a" })).resolves.toEqual({ from: "notonq" });
    expect(urls).toEqual(["http://notonq.test/q/app/ghostq/search?query=a"]);
  });

  it("goes straight to Qloo when NotOnQ doesn't answer", async () => {
    const urls = fakeFetch("down");
    await expect(qlooGet("/search", { query: "b" })).resolves.toEqual({ from: "qloo" });
    expect(urls).toEqual(["http://notonq.test/q/app/ghostq/search?query=b", "http://qloo.test/search?query=b"]);
  });

  it("goes straight to Qloo on a NotOnQ 5xx", async () => {
    const urls = fakeFetch(502);
    await expect(qlooGet("/search", { query: "c" })).resolves.toEqual({ from: "qloo" });
    expect(urls).toHaveLength(2);
  });

  it("passes a 400 on as Qloo's answer, without asking Qloo again", async () => {
    const urls = fakeFetch(400);
    await expect(qlooGet("/search", { query: "d" })).rejects.toMatchObject({ status: 400 });
    expect(urls).toHaveLength(1);
  });
});
