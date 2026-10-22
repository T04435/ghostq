import "server-only";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { DEVICE_COOKIE, isDeviceId } from "@/lib/device";
import { env, providerStatus } from "@/server/env";

/**
 * Daily budgets and per-visitor limits, so a busy judging room can't run up Lyria or Qloo (Qloo's 10,000 calls a month
 * are shared with Busk Map).
 * - Visitors are counted per device (the `ghostq_device` cookie), so judges on one network each get their own
 *   allowance, with a loose per-network (hashed IP) ceiling behind it: a cookie is easy to drop.
 * - "Limits off until <time>" (judging days) skips the per-visitor limits and swaps the daily budgets for higher
 *   judging ones; the money cap on singing never goes away. Set it with `scripts/limits.mjs` (Neon, no redeploy) or
 *   GHOSTQ_LIMITS_OFF_UNTIL.
 * Every number is an env var. Counters live in Neon (table `usage`), or in memory without a database.
 */
const num = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function limits() {
  return {
    /** Songs Lyria may sing per UTC day (about US$0.08 each); the judging figure while limits are off. */
    lyriaPerDay: num(process.env.GHOSTQ_LYRIA_PER_DAY, 150),
    lyriaPerDayJudging: num(process.env.GHOSTQ_LYRIA_PER_DAY_JUDGING, 500),
    /** Live (uncached) Qloo calls per UTC day; a run makes about 9. */
    qlooPerDay: num(process.env.GHOSTQ_QLOO_PER_DAY, 1200),
    qlooPerDayJudging: num(process.env.GHOSTQ_QLOO_PER_DAY_JUDGING, 3000),
    /** A run needs about this many Qloo calls left to start. */
    qlooPerRun: num(process.env.GHOSTQ_QLOO_PER_RUN, 15),
    /** Per device per hour. */
    device: {
      write: num(process.env.GHOSTQ_WRITES_PER_DEVICE_HOUR, 30),
      sing: num(process.env.GHOSTQ_SINGS_PER_DEVICE_HOUR, 15),
      search: num(process.env.GHOSTQ_SEARCHES_PER_DEVICE_HOUR, 300),
    },
    /** Per network (one IP, maybe a whole room) per hour: the backstop behind the device limits. */
    network: {
      write: num(process.env.GHOSTQ_WRITES_PER_IP_HOUR, 300),
      sing: num(process.env.GHOSTQ_SINGS_PER_IP_HOUR, 150),
      search: num(process.env.GHOSTQ_SEARCHES_PER_IP_HOUR, 3000),
    },
  };
}

const DAY = 86_400;
const HOUR = 3_600;

/** The bucket a counter falls in: its key plus the start of its window, so each window counts from zero. */
function bucket(key: string, windowSeconds: number, now = Date.now()): { name: string; expires: Date } {
  const start = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
  return { name: `${key}:${start}`, expires: new Date((start + windowSeconds) * 1000) };
}

type Counter = { add(name: string, n: number, expires: Date): Promise<number>; get(name: string): Promise<number> };

const memory = new Map<string, { count: number; expires: number }>();
const memoryCounter: Counter = {
  async add(name, n, expires) {
    const now = Date.now();
    for (const [k, v] of memory) if (v.expires <= now) memory.delete(k);
    const count = (memory.get(name)?.count ?? 0) + n;
    memory.set(name, { count, expires: expires.getTime() });
    return count;
  },
  async get(name) {
    const hit = memory.get(name);
    return hit && hit.expires > Date.now() ? hit.count : 0;
  },
};

let schema: Promise<unknown> | null = null;
const sql = () => neon(env.DATABASE_URL!);
function ensureSchema() {
  schema ??= sql()`CREATE TABLE IF NOT EXISTS usage (bucket text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL)`
    .then(() => sql()`CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value text NOT NULL)`)
    .catch((e) => {
      schema = null;
      throw e;
    });
  return schema;
}
const neonCounter: Counter = {
  async add(name, n, expires) {
    await ensureSchema();
    // Old windows are cleared now and then; they no longer count either way.
    if (Math.random() < 0.02) await sql()`DELETE FROM usage WHERE expires_at < now()`;
    const rows = (await sql()`
      INSERT INTO usage (bucket, count, expires_at) VALUES (${name}, ${n}, ${expires.toISOString()})
      ON CONFLICT (bucket) DO UPDATE SET count = usage.count + ${n} RETURNING count`) as { count: number }[];
    return rows[0]?.count ?? n;
  },
  async get(name) {
    await ensureSchema();
    const rows = (await sql()`SELECT count FROM usage WHERE bucket = ${name}`) as { count: number }[];
    return rows[0]?.count ?? 0;
  },
};

const counter = (): Counter => (providerStatus().database ? neonCounter : memoryCounter);

// ---- The judging-day switch ---------------------------------------------------------------------------------------

let offCache: { until: number; read: number } | null = null;

/** When the limits are off until, or 0. From GHOSTQ_LIMITS_OFF_UNTIL, else Neon's `settings`; read at most every 30 s. */
async function offUntil(): Promise<number> {
  const fromEnv = Date.parse(process.env.GHOSTQ_LIMITS_OFF_UNTIL ?? "");
  if (Number.isFinite(fromEnv)) return fromEnv;
  if (!providerStatus().database) return 0;
  if (offCache && Date.now() - offCache.read < 30_000) return offCache.until;
  try {
    await ensureSchema();
    const rows = (await sql()`SELECT value FROM settings WHERE key = 'limits_off_until'`) as { value: string }[];
    const until = Date.parse(rows[0]?.value ?? "");
    offCache = { until: Number.isFinite(until) ? until : 0, read: Date.now() };
  } catch {
    offCache = { until: 0, read: Date.now() };
  }
  return offCache.until;
}

export async function limitsOff(): Promise<boolean> {
  return (await offUntil()) > Date.now();
}

// ---- Who's asking -------------------------------------------------------------------------------------------------

const hash = (value: string) => createHash("sha256").update(`ghostq:${value}`).digest("hex").slice(0, 16);

/** A network's id for the backstop: a hash of the IP Vercel saw (first x-forwarded-for entry), never the IP itself. */
export function visitor(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return hash(ip);
}

/** A device's id from its cookie (hashed too), or null when the request has none (curl, cookies blocked). */
export function device(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie.split(";").map((c) => c.trim().split("=")).find(([k]) => k === DEVICE_COOKIE)?.[1];
  return isDeviceId(value) ? hash(value) : null;
}

// ---- The checks ---------------------------------------------------------------------------------------------------

export type Refusal = { error: string; budget: true; status: 429; retryAfter: number };

function refusal(error: string, until: Date): Refusal {
  return { error, budget: true, status: 429, retryAfter: Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000)) };
}

const WHAT = { write: "songs written", sing: "songs sung", search: "artist searches" } as const;

/** Counts one use against this device's and this network's hourly limits; a refusal when either is over. Off on judging days. */
export async function perVisitor(kind: "write" | "sing" | "search", request: Request): Promise<Refusal | null> {
  if (await limitsOff()) return null;
  const { device: perDevice, network } = limits();
  const id = device(request);
  if (id) {
    const b = bucket(`dev:${kind}:${id}`, HOUR);
    if ((await counter().add(b.name, 1, b.expires)) > perDevice[kind]) {
      return refusal(`This browser has reached this hour's limit of ${WHAT[kind]} (${perDevice[kind]}). Try again later.`, b.expires);
    }
  }
  const b = bucket(`ip:${kind}:${visitor(request)}`, HOUR);
  if ((await counter().add(b.name, 1, b.expires)) > network[kind]) {
    return refusal(`Your network has reached this hour's limit of ${WHAT[kind]} (${network[kind]}). Try again later.`, b.expires);
  }
  return null;
}

/** Takes one song from today's singing budget (the judging one on judging days); a refusal when it's spent. */
export async function takeLyria(): Promise<Refusal | null> {
  const b = bucket("lyria", DAY);
  const max = (await limitsOff()) ? limits().lyriaPerDayJudging : limits().lyriaPerDay;
  const count = await counter().add(b.name, 1, b.expires);
  return count <= max ? null : refusal("GhostQ has sung all the songs it can today. Singing comes back tomorrow (UTC).", b.expires);
}

/** Whether today's Qloo budget (the judging one on judging days) has room for a run. Calls are added after the run. */
/** `runs`: how many runs' worth of Qloo calls must be left (a CollabQ reads two crowds, so it reserves two). */
export async function checkQloo(runs = 1): Promise<Refusal | null> {
  const b = bucket("qloo", DAY);
  const used = await counter().get(b.name);
  const max = (await limitsOff()) ? limits().qlooPerDayJudging : limits().qlooPerDay;
  return used + limits().qlooPerRun * runs <= max ? null : refusal("GhostQ has used today's Qloo research budget. New songs come back tomorrow (UTC).", b.expires);
}

export async function addQlooCalls(calls: number): Promise<void> {
  if (calls <= 0) return;
  const b = bucket("qloo", DAY);
  await counter().add(b.name, calls, b.expires);
}

export function refusalResponse(r: Refusal): Response {
  return Response.json({ error: r.error, budget: true }, { status: r.status, headers: { "Retry-After": String(r.retryAfter) } });
}
