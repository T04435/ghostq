import { generateText, Output } from "ai";
import { z } from "zod";
import { briefSchema, describeBrief, type Crowd } from "@/lib/brief";
import { plainSongSchema } from "@/lib/plain-song";
import { MODELS } from "@/server/agent/models";
import { providerStatus } from "@/server/env";

export const maxDuration = 120;


/** The same brief written by the same model with no Qloo data, for the side-by-side on /how. */
export async function POST(request: Request) {
  // The same brief and the same crowd GhostQ read from Qloo, so the only difference is the taste data.
  const parsed = z.object({ brief: briefSchema, crowd: z.custom<Crowd>((c) => typeof c === "object" && c !== null) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid brief" }, { status: 400 });
  if (!providerStatus().aiGateway) return Response.json({ error: "AI Gateway key missing in .env.local" }, { status: 503 });
  try {
    const { output } = await generateText({
      model: MODELS.plain,
      output: Output.object({ schema: plainSongSchema }),
      prompt: `${describeBrief(parsed.data.brief, parsed.data.crowd)}\nWrite an original song for this crowd: verses, a repeating chorus and a bridge, with chords over each line and a short production brief. Don't quote existing lyrics or name real artists in the lyrics.`,
      maxOutputTokens: 4000,
      abortSignal: AbortSignal.timeout(100_000),
    });
    return Response.json(output);
  } catch (error) {
    console.error("plain song failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "The plain AI version failed. Try again." }, { status: 502 });
  }
}
