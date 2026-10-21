import "server-only";
import { z } from "zod";
import { env } from "@/server/env";

const URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
/** Google doesn't state a generation time; allow up to 4 minutes. */
const TIMEOUT_MS = 240_000;

export class LyriaError extends Error {
  /** "blocked": Google's content filter refused the prompt. It's inconsistent: the same song often passes on a retry (seen 21 Oct). */
  constructor(message: string, readonly status: number, readonly kind: "blocked" | "other" = "other") {
    super(message);
    this.name = "LyriaError";
  }
}

const response = z.object({
  steps: z
    .array(z.object({ type: z.string(), content: z.array(z.object({ type: z.string(), data: z.string().optional(), text: z.string().optional() })).optional() }))
    .default([]),
});

/**
 * One full song from Lyria 3.5 (US$0.08 a song, paid tier only, per Google's pricing page of 19 Oct 2026).
 * Returns MP3 bytes, plus any text Lyria sends back. Every output carries a SynthID watermark.
 */
export async function generateSong(prompt: string): Promise<{ audio: Buffer; text: string }> {
  if (!env.GEMINI_API_KEY) throw new LyriaError("Singing isn't configured (GEMINI_API_KEY)", 0);
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({ model: "lyria-3.5", input: prompt, response_format: { type: "audio" } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const blocked = /prohibited_content|prohibited use policy|sensitive words/i.test(body);
    throw new LyriaError(`Lyria returned ${res.status}${body ? `: ${body.slice(0, 300)}` : ""}`, res.status, blocked ? "blocked" : "other");
  }
  const parsed = response.parse(await res.json());
  const parts = parsed.steps.filter((s) => s.type === "model_output").flatMap((s) => s.content ?? []);
  const audio = parts.find((p) => p.type === "audio" && p.data)?.data;
  if (!audio) throw new LyriaError("Lyria sent no audio (the safety filter may have blocked the prompt)", 502, "blocked");
  return { audio: Buffer.from(audio, "base64"), text: parts.filter((p) => p.type === "text").map((p) => p.text ?? "").join("\n") };
}
