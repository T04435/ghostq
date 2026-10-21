import { z } from "zod";
import { buildSingPrompt } from "@/lib/sing-prompt";
import { writtenSongSchema, type SongSheet } from "@/lib/song-sheet";
import { providerStatus } from "@/server/env";
import { generateSong, LyriaError } from "@/server/lyria";
import { isSongId, saveAudio } from "@/server/store/songs";
import { vocalLineSchema } from "@/lib/voice";

export const maxDuration = 300;

const sheetSchema = writtenSongSchema.extend({
  artist: z.string(),
  id: z.string().optional(),
  crowd: z.unknown(),
  vocals: z.unknown(),
  language: z.string(),
  signals: z.array(z.object({ id: z.string(), kind: z.string(), label: z.string(), source: z.string(), value: z.number().nullable() })),
  warnings: z.array(z.string()),
});

/** POST a song sheet → an MP3 of it, sung and produced by Lyria. Costs about US$0.08 per call. */
export async function POST(request: Request) {
  // The vocals are required: Lyria picking its own voice put a female voice on a male artist's song (user, 21 Oct).
  const body = z.object({ sheet: sheetSchema, vocals: vocalLineSchema, songId: z.string().refine(isSongId).optional() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Choose the vocals before singing" }, { status: 400 });
  if (!providerStatus().gemini) return Response.json({ error: "Singing isn't available right now." }, { status: 503 });
  try {
    const { audio } = await generateSong(buildSingPrompt(body.data.sheet as SongSheet, body.data.vocals));
    // Kept with the saved song so the share link plays it and a reload doesn't lose it.
    if (body.data.songId) await saveAudio(body.data.songId, body.data.vocals, audio).catch((e) => console.error("save audio failed", e instanceof Error ? e.message : e));
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof LyriaError ? error.message : "Singing failed";
    console.error("sing failed", message);
    if (error instanceof LyriaError && error.kind === "blocked") {
      return Response.json(
        {
          error: "Google's music model (Lyria) blocked this attempt under its content policy (prohibited content). It doesn't say which words, and it's inconsistent: the same song often goes through on another try.",
          retry: true,
        },
        { status: 422 },
      );
    }
    return Response.json({ error: message, retry: true }, { status: error instanceof LyriaError && error.status >= 400 ? error.status : 502 });
  }
}
