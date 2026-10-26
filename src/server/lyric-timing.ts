import "server-only";
import { gateway, transcribe } from "ai";
import { alignLyrics, type SungTiming } from "@/lib/lyric-align";
import type { SongSheet } from "@/lib/song-sheet";

/**
 * When each line of a sung song is sung: Whisper (openai/whisper-1 through AI Gateway, about US$0.018 a 3-minute song)
 * hears the MP3 and lyric-align matches its segments to the sheet. Lyria returns no timings, and a language model
 * asked for them guessed (probed 26 Oct: times past the end of the track); Whisper's segments matched the lines.
 */
export async function timeSung(sheet: Pick<SongSheet, "sections">, audio: Uint8Array): Promise<SungTiming> {
  const result = await transcribe({ model: gateway.transcriptionModel("openai/whisper-1"), audio, abortSignal: AbortSignal.timeout(120_000) });
  const lines = sheet.sections.flatMap((s) => s.lines.map((l) => l.text));
  const heard = result.segments.map((s) => ({ text: s.text, start: s.startSecond, end: s.endSecond }));
  return alignLyrics(lines, heard, result.durationInSeconds ?? heard.at(-1)?.end ?? 120);
}
