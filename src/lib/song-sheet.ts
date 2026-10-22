import { z } from "zod";
import { normalizeCrowd, type Crowd } from "./brief";
import type { Signal } from "./signals";
import { legacyDirection, normalizeVocals, type VocalMatch } from "./voice";

export const lineSchema = z.object({
  text: z.string().describe("One sung line, in the brief's language"),
  chords: z.string().describe('Chords over this line, e.g. "Am  F  C  G"'),
  signalIds: z.array(z.string()).describe("Ids of the Qloo signals behind this line, e.g. [\"T1\", \"M2\"]. At least one."),
});

export const sectionSchema = z.object({
  name: z.string().describe('e.g. "Verse 1", "Chorus", "Bridge"'),
  lines: z.array(lineSchema).min(2).max(8),
  melody: z.string().describe("Melody notes for this section in plain words: range, contour, rhythm"),
  voices: z
    .string()
    .optional()
    .describe('Only with more than one voice: who performs this section, by letter, e.g. "A", "B" or "A and B"'),
});

/** What the writer model returns. */
export const writtenSongSchema = z.object({
  title: z.string(),
  key: z.string().describe('e.g. "A minor"'),
  tempo: z.number().int().min(50).max(200).describe("BPM"),
  feel: z.string().describe("One sentence on the groove and mood"),
  genre: z
    .string()
    .describe("The genre in a few words, built from the artist's genre and style signals and citing their ids, e.g. \"Minimalist indie pop (S1) with dream-pop shimmer (S2) over a soft electronic pulse (G1)\""),
  vocalDirection: z
    .string()
    .describe("1–2 sentences: how the given voices perform this song (sung, rapped, spoken, whispered, harmonies, who takes which part), grounded in the signals and citing their ids"),
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
  /** The voices that match the artist (how many, which gender), for singing. From data, never the model. */
  vocals: VocalMatch;
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
  out.push("## Genre", sheet.genre, "", "## Vocal direction", sheet.vocalDirection, "", "## Production brief", sheet.productionBrief, "", "## Why it fits", sheet.angle, "", "## Qloo signals");
  for (const s of sheet.signals) out.push(`- ${s.id}: ${s.label} (${s.kind}, ${s.source}${s.value !== null ? `, ${s.value}` : ""})`);
  return out.join("\n");
}

/**
 * A sheet as stored, read into today's shape. Before 22 Oct: a city id on the crowd and one lead voice. Before 23 Oct:
 * no genre or vocal direction, so they come from the sheet's own genre and style receipts (the artist's Qloo tags) and
 * its old rap-or-sung setting.
 */
export function normalizeSheet(raw: SongSheet): SongSheet {
  const { voice, ...sheet } = raw as SongSheet & { voice?: unknown };
  const vocals = normalizeVocals(sheet.vocals ?? voice);
  const tags = (sheet.signals ?? []).filter((s) => s.kind === "genre" || s.kind === "style");
  return {
    ...sheet,
    crowd: normalizeCrowd(sheet.crowd),
    vocals: { voices: vocals.voices, source: vocals.source },
    genre: sheet.genre ?? tags.map((s) => s.label.trim()).join(", "),
    vocalDirection: sheet.vocalDirection ?? legacyDirection(vocals.delivery, tags.map((s) => s.label)),
  };
}
