// Times the sing-along for every sung song that has no timing yet: Whisper (AI Gateway, about US$0.012 a song) hears
// the public MP3 and lyric-align matches it to the sheet. Run: VERCEL_ENV=production node --env-file=.env.local scripts/time-songs.mjs [--count]
import { neon } from "@neondatabase/serverless";
import { gateway, transcribe } from "ai";
import { alignLyrics } from "../src/lib/lyric-align.ts";

if (process.env.VERCEL_ENV !== "production") {
  console.error("This writes to the production database: run it with VERCEL_ENV=production (see the comment at the top).");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`SELECT id, sheet, audio_created_at FROM songs WHERE audio_voice IS NOT NULL AND audio_timing IS NULL ORDER BY created_at`;
console.log(`${rows.length} sung songs without timing`);
if (process.argv.includes("--count")) process.exit(0);

for (const row of rows) {
  const url = `https://ghostq.xyz/api/songs/${row.id}/audio?v=${encodeURIComponent(new Date(row.audio_created_at).toISOString())}`;
  try {
    const audio = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const result = await transcribe({ model: gateway.transcriptionModel("openai/whisper-1"), audio });
    const lines = row.sheet.sections.flatMap((s) => s.lines.map((l) => l.text));
    const heard = result.segments.map((s) => ({ text: s.text, start: s.startSecond, end: s.endSecond }));
    const timing = alignLyrics(lines, heard, result.durationInSeconds ?? heard.at(-1)?.end ?? 120);
    await sql`UPDATE songs SET audio_timing = ${JSON.stringify(timing)}::jsonb WHERE id = ${row.id}`;
    const hit = timing.lines.filter(Boolean).length;
    console.log(`${row.id} ${row.sheet.title}: ${hit}/${lines.length} lines heard, ${Math.round(timing.duration)} s`);
  } catch (e) {
    console.log(`${row.id} failed: ${e instanceof Error ? e.message : e}`);
  }
}
