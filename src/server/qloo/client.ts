import "server-only";
import { env } from "@/server/env";

/** Some Qloo calls took 11–18 s in the day-1 probes (tag signals, places), so 25 s. */
const TIMEOUT_MS = 25_000;
/** The hackathon key allows 5 requests/s and is shared with Busk Map: start calls at least 220 ms apart. */
const MIN_GAP_MS = 220;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

export type QlooParams = Record<string, string | number | boolean | undefined>;

type Entry = { at: number; value: Promise<unknown> };
const cache = new Map<string, Entry>();
let nextSlot = 0;

async function paced(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + MIN_GAP_MS;
  if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now));
}

export type CallLog = { path: string; params: QlooParams; ms: number; cached: boolean; status: number };

/**
 * GET a Qloo endpoint. Results are cached in memory for 24 h by path and
 * params; a failed call is not cached. One retry on a 5xx or network error.
 */
export async function qlooGet<T>(path: string, params: QlooParams, onCall?: (log: CallLog) => void): Promise<T> {
  if (!env.QLOO_API_KEY) throw new QlooError("Qloo isn't configured (QLOO_API_KEY)", 0);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params).sort(([a], [b]) => a.localeCompare(b))) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const url = `${env.QLOO_API_BASE_URL}${path}?${query}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    const value = (await hit.value) as T;
    onCall?.({ path, params, ms: 0, cached: true, status: 200 });
    return value;
  }
  const started = Date.now();
  const value = fetchWithRetry(url, env.QLOO_API_KEY);
  cache.set(url, { at: started, value });
  try {
    const result = (await value) as T;
    onCall?.({ path, params, ms: Date.now() - started, cached: false, status: 200 });
    return result;
  } catch (error) {
    cache.delete(url);
    onCall?.({ path, params, ms: Date.now() - started, cached: false, status: error instanceof QlooError ? error.status : 0 });
    throw error;
  }
}

async function fetchWithRetry(url: string, key: string, attempt = 0): Promise<unknown> {
  await paced();
  let response: Response;
  try {
    response = await fetch(url, { headers: { "X-Api-Key": key, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    if (attempt === 0) return fetchWithRetry(url, key, 1);
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new QlooError(timedOut ? "Qloo took longer than 25 s" : "Couldn't reach Qloo", 0);
  }
  if (response.status >= 500 && attempt === 0) return fetchWithRetry(url, key, 1);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new QlooError(`Qloo returned ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`, response.status);
  }
  return response.json();
}
