import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/env", () => ({ providerStatus: () => ({ database: false }), env: {} }));

const { addQlooCalls, checkQloo, device, limitsOff, perVisitor, takeLyria, visitor } = await import("@/server/limits");

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const req = (ip: string, deviceId?: string) =>
  new Request("http://x", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1`, ...(deviceId ? { cookie: `theme=dark; ghostq_device=${deviceId}` } : {}) } });

describe("limits (in memory, no database)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("counts networks and devices by hashes, never the IP or the cookie", () => {
    const id = uuid();
    expect(visitor(req("203.0.113.7"))).toMatch(/^[0-9a-f]{16}$/);
    expect(visitor(req("203.0.113.7"))).not.toContain("203");
    expect(device(req("203.0.113.7", id))).toMatch(/^[0-9a-f]{16}$/);
    expect(device(req("203.0.113.7", "not-a-uuid"))).toBeNull();
    expect(device(req("203.0.113.7"))).toBeNull();
  });

  it("gives each device on one network its own allowance", async () => {
    vi.stubEnv("GHOSTQ_WRITES_PER_DEVICE_HOUR", "1");
    const [a, b] = [uuid(), uuid()];
    expect(await perVisitor("write", req("198.51.100.1", a))).toBeNull();
    expect(await perVisitor("write", req("198.51.100.1", a))).toMatchObject({ budget: true, error: expect.stringContaining("This browser") });
    expect(await perVisitor("write", req("198.51.100.1", b))).toBeNull();
  });

  it("keeps a per-network ceiling behind the cookie (dropping it doesn't help)", async () => {
    vi.stubEnv("GHOSTQ_WRITES_PER_IP_HOUR", "2");
    expect(await perVisitor("write", req("198.51.100.9", uuid()))).toBeNull();
    expect(await perVisitor("write", req("198.51.100.9"))).toBeNull();
    const third = await perVisitor("write", req("198.51.100.9", uuid()));
    expect(third).toMatchObject({ budget: true, status: 429, error: expect.stringContaining("Your network") });
    expect(third?.retryAfter).toBeGreaterThan(0);
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

  it("judging days: per-visitor limits off, the higher budgets on, the singing cap still there", async () => {
    vi.stubEnv("GHOSTQ_LIMITS_OFF_UNTIL", new Date(Date.now() + 3_600_000).toISOString());
    vi.stubEnv("GHOSTQ_WRITES_PER_DEVICE_HOUR", "0");
    vi.stubEnv("GHOSTQ_WRITES_PER_IP_HOUR", "0");
    vi.stubEnv("GHOSTQ_LYRIA_PER_DAY", "0");
    vi.stubEnv("GHOSTQ_LYRIA_PER_DAY_JUDGING", "0");
    expect(await limitsOff()).toBe(true);
    expect(await perVisitor("write", req("192.0.2.1", uuid()))).toBeNull();
    expect(await takeLyria()).toMatchObject({ budget: true });
    vi.stubEnv("GHOSTQ_LYRIA_PER_DAY_JUDGING", "1000");
    expect(await takeLyria()).toBeNull();
  });

  it("an expired switch means limits are back on", async () => {
    vi.stubEnv("GHOSTQ_LIMITS_OFF_UNTIL", new Date(Date.now() - 1000).toISOString());
    expect(await limitsOff()).toBe(false);
  });
});
