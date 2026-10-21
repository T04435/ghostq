import { z } from "zod";
import type { Crowd } from "./brief";
import type { Signal } from "./signals";
import type { VoiceMatch } from "./voice";

export const lineSchema = z.object({
  text: z.string().describe("One sung line, in the brief's language"),
  chords: z.string().describe('Chords over this line, e.g. "Am  F  C  G"'),
  signalIds: z.array(z.string()).describe("Ids of the Qloo signals behind this line, e.g. [\"T1\", \"M2\"]. At least one."),
});

export const sectionSchema = z.object({
  name: z.string().describe('e.g. "Verse 1", "Chorus", "Bridge"'),
  lines: z.array(lineSchema).min(2).max(8),
  melody: z.string().describe("Melody notes for this section in plain words: range, contour, rhythm"),
});

/** What the writer model returns. */
export const writtenSongSchema = z.object({
  title: z.string(),
  key: z.string().describe('e.g. "A minor"'),
  tempo: z.number().int().min(50).max(200).describe("BPM"),
  feel: z.string().describe("One sentence on the groove and mood"),
  sections: z.array(sectionSchema).min(3).max(8),
  productionBrief: z.string().describe("3–5 sentences: instruments, arrangement, production, referencing signal ids for style"),
  angle: z.string().describe("One sentence: why this song fits this crowd, citing signal ids"),
});
export type WrittenSong = z.infer<typeof writtenSongSchema>;

/** What the app keeps and shows: the song plus the signals it cites. */
export type SongSheet = WrittenSong & {
  /** Set once the song is saved: its share link is /song/{id}. */
  id?: string;
  /** Qloo's name for the artist the song was written from. */
  artist: string;
  /** The crowd it was written for, read from Qloo. */
  crowd: Crowd;
  /** The lead vocal that matches the artist, for singing. */
  voice: VoiceMatch;
  language: string;
  signals: Signal[];
  /** Problems the validator found and couldn't fix after the repair pass. */
  warnings: string[];
};

export function sheetToMarkdown(sheet: SongSheet): string {
  const out = [`# ${sheet.title}`, "", `${sheet.key} · ${sheet.tempo} BPM · ${sheet.language}`, "", sheet.feel, ""];
  for (const section of sheet.sections) {
    out.push(`## ${section.name}`, `_Melody: ${section.melody}_`, "");
    for (const line of section.lines) out.push(`    ${line.chords}`, `${line.text}  [${line.signalIds.join(", ")}]`);
    out.push("");
  }
  out.push("## Production brief", sheet.productionBrief, "", "## Why it fits", sheet.angle, "", "## Qloo signals");
  for (const s of sheet.signals) out.push(`- ${s.id}: ${s.label} (${s.kind}, ${s.source}${s.value !== null ? `, ${s.value}` : ""})`);
  return out.join("\n");
}
