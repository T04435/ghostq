import { after } from "next/server";
import { z } from "zod";
import { singProblem } from "@/lib/sing-check";
import { buildSingPrompt } from "@/lib/sing-prompt";
import { vocalLineSchema } from "@/lib/voice";
import { botRefusal } from "@/server/bot";
import { providerStatus } from "@/server/env";
import { perVisitor, refusalResponse, takeLyria } from "@/server/limits";
import { timeSung } from "@/server/lyric-timing";
import { generateSong, LyriaError } from "@/server/lyria";
import { getSong, isSongId, recordSingBlock, saveAudio, saveTiming, SING_BLOCKS_TO_HIDE } from "@/server/store/songs";

export const maxDuration = 300;

/**
 * POST {songId, vocals} → an MP3 of that saved song, sung and produced by Lyria (about US$0.08 a call). The sheet is
 * always the saved one, read here: a client can't send its own lyrics, so the artist check can't be bypassed.
 */
export async function POST(request: Request) {
  // The vocals are required: Lyria picking its own voice put a female voice on a male artist's song (user, 21 Oct).
  const body = z.object({ songId: z.string().refine(isSongId), vocals: vocalLineSchema }).safeParse(await request.json().catch(() => null));
  if (!body.success) {
    const tooLong = body.error.issues.some((i) => i.code === "too_big" && (i.path.includes("direction") || i.path.includes("genre")));
    return Response.json({ error: tooLong ? "The genre or vocal direction is too long. Shorten it under “Genre and vocal direction”." : "Choose the vocals before singing" }, { status: 400 });
  }
  if (!providerStatus().gemini) return Response.json({ error: "Singing isn't available right now." }, { status: 503 });
  const { songId, vocals } = body.data;
  const song = await getSong(songId);
  if (!song) return Response.json({ error: "This song wasn't saved, so it can't be sung. Write it again." }, { status: 404 });
  const problem = singProblem(song.sheet, vocals);
  if (problem) return Response.json({ error: problem }, { status: 422 });
  const bot = await botRefusal();
  if (bot) return bot;
  const refused = (await perVisitor("sing", request)) ?? (await takeLyria());
  if (refused) return refusalResponse(refused);
  try {
    const { audio } = await generateSong(buildSingPrompt(song.sheet, vocals));
    // Kept with the saved song so the share link plays it and a reload doesn't lose it.
    const saved = await saveAudio(songId, vocals, audio).then(
      () => true,
      (e) => console.error("save audio failed", e instanceof Error ? e.message : e),
    );
    // The sing-along's timing, after the response: Whisper hears the new audio (the page polls for it).
    if (saved)
      after(() =>
        timeSung(song.sheet, audio)
          .then((timing) => saveTiming(songId, timing))
          .catch((e) => console.error("timing failed", e instanceof Error ? e.message : e)),
      );
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof LyriaError ? error.message : "Singing failed";
    console.error("sing failed", message);
    if (error instanceof LyriaError && error.kind === "blocked") {
      const { blocks, hidden } = await recordSingBlock(songId).catch(() => ({ blocks: 0, hidden: false }));
      const base = "Google's music model (Lyria) blocked this attempt under its content policy (prohibited content). It doesn't say which words, and it's inconsistent: the same song often goes through on another try.";
      return Response.json(
        hidden
          ? { error: `${base} Lyria has now refused this song ${blocks} times, so it's been taken out of the Songbook; its link still works.`, retry: false }
          : { error: `${base} (Refusal ${blocks} of ${SING_BLOCKS_TO_HIDE}: at ${SING_BLOCKS_TO_HIDE} the song leaves the Songbook.)`, retry: true },
        { status: 422 },
      );
    }
    return Response.json({ error: message, retry: true }, { status: error instanceof LyriaError && error.status >= 400 ? error.status : 502 });
  }
}
