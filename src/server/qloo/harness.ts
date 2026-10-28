import "server-only";
import { createQlooToolsFromEnvironment } from "@qloo/qloo-harness";
import { env } from "@/server/env";
import { type CallLog, fallsBack, hasFallback, paced, QlooError } from "./client";

/**
 * Qloo's own harness (@qloo/qloo-harness), pointed at the same base URL as every other Qloo call (NotOnQ by default),
 * for the calls it expresses exactly as GhostQ makes them (see api.ts). Each call keeps GhostQ's rules: one Qloo slot
 * at a time, a 24 h cache, and a CallLog for the budget. Only the derived results go back to the run. When NotOnQ
 * doesn't answer or fails, the call goes to Qloo directly (as plain calls do, see client.ts).
 */

/** The part of the harness's tool definition GhostQ calls (the Pi agent ToolDefinition: id, input, signal, onUpdate, ctx). */
type Tool = { name: string; execute: (id: string, input: unknown, signal?: AbortSignal, onUpdate?: unknown, ctx?: unknown) => Promise<{ details?: unknown; content?: { type: string; text?: string }[] }> };
export type HarnessResult = Record<string, unknown> & { entity_id?: string; name?: string; affinity?: number; popularity?: number; query?: unknown };

const toolsByBase = new Map<string, Map<string, Tool>>();
function tool(name: string, base: string): Tool {
  let tools = toolsByBase.get(base);
  if (!tools) {
    tools = new Map(
      createQlooToolsFromEnvironment({
        env: { QLOO_API_KEY: env.QLOO_API_KEY, QLOO_BASE_URL: base, QLOO_TRUSTED_BASE_URL: base, PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: process.env.NODE_ENV } as NodeJS.ProcessEnv,
      }).map((t) => [t.name, t as unknown as Tool]),
    );
    toolsByBase.set(base, tools);
  }
  const t = tools.get(name);
  if (!t) throw new QlooError(`Qloo's harness has no ${name} tool`, 0);
  return t;
}

/** The harness's error codes, as the HTTP statuses the rest of GhostQ reads (a 400 means "not usable as a signal"). */
const STATUS: Record<string, number> = { QLOO_CONTRACT: 400, QLOO_AUTH: 401, QLOO_TIMEOUT: 0 };

async function call(name: string, input: Record<string, unknown>, base: string, id: string): Promise<HarnessResult[]> {
  await paced();
  const out = await tool(name, base).execute(id, input, AbortSignal.timeout(28_000));
  const d = (out.details ?? JSON.parse(out.content?.[0]?.text ?? "{}")) as {
    status?: string;
    summary?: string;
    results?: HarnessResult[];
    error?: { code?: string };
  };
  if (d.status === "ok") return d.results ?? [];
  const status = d.status === "needs_input" ? 400 : (STATUS[d.error?.code ?? ""] ?? 502);
  throw new QlooError(`Qloo (harness ${name}): ${d.summary ?? d.status}`, status);
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: Promise<HarnessResult[]> }>();

export async function harness(name: string, input: Record<string, unknown>, onCall?: (log: CallLog) => void): Promise<HarnessResult[]> {
  if (!env.QLOO_API_KEY) throw new QlooError("Qloo isn't configured (QLOO_API_KEY)", 0);
  const path = `harness:${name}`;
  const params = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : (v as string | number | boolean)]));
  const key = `${name} ${JSON.stringify(input)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    const value = await hit.value;
    onCall?.({ path, params, ms: 0, cached: true, status: 200 });
    return value;
  }
  const started = Date.now();
  const id = `ghostq-${started}`;
  const value = call(name, input, env.QLOO_API_BASE_URL, id).catch((error) =>
    hasFallback() && fallsBack(error) ? call(name, input, env.QLOO_DIRECT_BASE_URL, id) : Promise.reject(error),
  );
  cache.set(key, { at: started, value });
  try {
    const result = await value;
    onCall?.({ path, params, ms: Date.now() - started, cached: false, status: 200 });
    return result;
  } catch (error) {
    cache.delete(key);
    onCall?.({ path, params, ms: Date.now() - started, cached: false, status: error instanceof QlooError ? error.status : 0 });
    throw error;
  }
}

/** Harness results in the Qloo response shape GhostQ's parsers read (affinity sits under query in Qloo's own JSON). */
export const asInsights = (results: HarnessResult[]) => ({ results: { entities: results.map((r) => ({ ...r, query: { ...(r.query as object), affinity: r.affinity } })) } });
