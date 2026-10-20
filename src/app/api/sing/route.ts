import { z } from "zod";
import { buildSingPrompt } from "@/lib/sing-prompt";
import { writtenSongSchema, type SongSheet } from "@/lib/song-sheet";
import { providerStatus } from "@/server/env";
import { generateSong, LyriaError } from "@/server/lyria";

export const maxDuration = 300;

const sheetSchema = writtenSongSchema.extend({
  language: z.string(),
  signals: z.array(z.object({ id: z.string(), kind: z.string(), label: z.string(), source: z.string(), value: z.number().nullable() })),
  warnings: z.array(z.string()),
});

/** POST a song sheet → an MP3 of it, sung and produced by Lyria. Costs about US$0.08 per call. */
export async function POST(request: Request) {
  const parsed = sheetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid song sheet" }, { status: 400 });
  if (!providerStatus().gemini) return Response.json({ error: "GEMINI_API_KEY is missing in .env.local" }, { status: 503 });
  try {
    const { audio } = await generateSong(buildSingPrompt(parsed.data as SongSheet));
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof LyriaError ? error.message : "Singing failed";
    console.error("sing failed", message);
    return Response.json({ error: message }, { status: error instanceof LyriaError && error.status >= 400 ? error.status : 502 });
  }
}
