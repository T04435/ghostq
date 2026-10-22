import "server-only";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { env, providerStatus } from "@/server/env";

/**
 * Daily budgets and per-visitor limits, so a busy judging room can't run up Lyria or Qloo (Qloo's 10,000 calls a month
 * are shared with Busk Map). Every number is an env var, with defaults generous enough for a room of judges on one
 * network. Counters live in Neon (table `usage`), or in memory without a database. Visitors are counted by a hash of
 * their IP, never the IP itself.
 */
const num = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function limits() {
  return {
    /** Songs Lyria may sing per UTC day (about US$0.08 each). */
    lyriaPerDay: num(process.env.GHOSTQ_LYRIA_PER_DAY, 150),
    /** Live (uncached) Qloo calls per UTC day; a run makes about 9. */
    qlooPerDay: num(process.env.GHOSTQ_QLOO_PER_DAY, 1200),
    /** A run needs about this many Qloo calls left to start. */
    qlooPerRun: num(process.env.GHOSTQ_QLOO_PER_RUN, 15),
    /** Per visitor (one IP, which may be a whole room) per hour. */
    writesPerHour: num(process.env.GHOSTQ_WRITES_PER_IP_HOUR, 40),
    singsPerHour: num(process.env.GHOSTQ_SINGS_PER_IP_HOUR, 20),
    searchesPerHour: num(process.env.GHOSTQ_SEARCHES_PER_IP_HOUR, 400),
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
  schema ??= sql()`CREATE TABLE IF NOT EXISTS usage (bucket text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL)`.catch((e) => {
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

/** A visitor's id for the per-IP limits: a hash of the IP Vercel saw (first x-forwarded-for entry). */
export function visitor(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`ghostq:${ip}`).digest("hex").slice(0, 16);
}

export type Refusal = { error: string; budget: true; status: 429; retryAfter: number };

function refusal(error: string, until: Date): Refusal {
  return { error, budget: true, status: 429, retryAfter: Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000)) };
}

/** Counts one use against a per-visitor hourly limit; a refusal when it's over. */
export async function perVisitor(kind: "write" | "sing" | "search", request: Request): Promise<Refusal | null> {
  const max = { write: limits().writesPerHour, sing: limits().singsPerHour, search: limits().searchesPerHour }[kind];
  const b = bucket(`ip:${kind}:${visitor(request)}`, HOUR);
  const count = await counter().add(b.name, 1, b.expires);
  if (count <= max) return null;
  const what = { write: "songs written", sing: "songs sung", search: "artist searches" }[kind];
  return refusal(`Your network has reached this hour's limit of ${what} (${max}). Try again later.`, b.expires);
}

/** Takes one song from today's singing budget; a refusal when it's spent. Counted before the call, as an attempt. */
export async function takeLyria(): Promise<Refusal | null> {
  const b = bucket("lyria", DAY);
  const count = await counter().add(b.name, 1, b.expires);
  return count <= limits().lyriaPerDay ? null : refusal("GhostQ has sung all the songs it can today. Singing comes back tomorrow (UTC).", b.expires);
}

/** Whether today's Qloo budget has room for a run. Calls are added after the run, as they were made. */
export async function checkQloo(): Promise<Refusal | null> {
  const b = bucket("qloo", DAY);
  const used = await counter().get(b.name);
  const { qlooPerDay, qlooPerRun } = limits();
  return used + qlooPerRun <= qlooPerDay ? null : refusal("GhostQ has used today's Qloo research budget. New songs come back tomorrow (UTC).", b.expires);
}

export async function addQlooCalls(calls: number): Promise<void> {
  if (calls <= 0) return;
  const b = bucket("qloo", DAY);
  await counter().add(b.name, calls, b.expires);
}

export function refusalResponse(r: Refusal): Response {
  return Response.json({ error: r.error, budget: true }, { status: r.status, headers: { "Retry-After": String(r.retryAfter) } });
}
