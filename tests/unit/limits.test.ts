import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/env", () => ({ providerStatus: () => ({ database: false }), env: {} }));

const { addQlooCalls, checkQloo, perVisitor, takeLyria, visitor } = await import("@/server/limits");

const req = (ip: string) => new Request("http://x", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

describe("limits (in memory, no database)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("counts visitors by a hash of their IP, never the IP", () => {
    expect(visitor(req("203.0.113.7"))).toMatch(/^[0-9a-f]{16}$/);
    expect(visitor(req("203.0.113.7"))).toBe(visitor(req("203.0.113.7")));
    expect(visitor(req("203.0.113.7"))).not.toContain("203");
  });

  it("refuses a visitor over the hourly limit, with a message and a retry time", async () => {
    vi.stubEnv("GHOSTQ_WRITES_PER_IP_HOUR", "2");
    expect(await perVisitor("write", req("198.51.100.1"))).toBeNull();
    expect(await perVisitor("write", req("198.51.100.1"))).toBeNull();
    const third = await perVisitor("write", req("198.51.100.1"));
    expect(third).toMatchObject({ budget: true, status: 429 });
    expect(third?.retryAfter).toBeGreaterThan(0);
    expect(await perVisitor("write", req("198.51.100.2"))).toBeNull();
  });

  it("stops singing when today's Lyria budget is spent", async () => {
    vi.stubEnv("GHOSTQ_LYRIA_PER_DAY", "0");
    expect(await takeLyria()).toMatchObject({ budget: true, error: expect.stringContaining("sung all the songs") });
  });

  it("refuses a new run when today's Qloo calls leave no room for one", async () => {
    vi.stubEnv("GHOSTQ_QLOO_PER_DAY", "40");
    vi.stubEnv("GHOSTQ_QLOO_PER_RUN", "15");
    expect(await checkQloo()).toBeNull();
    await addQlooCalls(30);
    expect(await checkQloo()).toMatchObject({ budget: true });
  });
});
