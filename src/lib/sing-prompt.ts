import type { SongSheet } from "./song-sheet";
import { VOICE_NAMES, type Delivery, type Gender, type VocalLine } from "./voice";

/** Signal ids like "(G2, G4)", "T1" or "[M1]" mean nothing to a music model. */
function stripSignalIds(text: string): string {
  return text
    .replace(/[([]\s*(?:[TSGAMBHC]\d+\s*,?\s*(?:and\s*)?)+[)\]]/g, "")
    .replace(/\b[TSGAMBHC]\d+\b/g, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const ROLE: Record<Delivery, string> = { sung: "singer", rap: "rapper", both: "vocalist who raps the verses and sings the chorus" };
/** Two or three voices of the same gender need telling apart: the probe of 22 Oct used these and got distinct voices. */
const TIMBRE = ["deeper and slower", "higher and faster", "raspy, mid-range"];

const VERSE = /^(verse|verso|couplet|strophe|vers)\b/i;
const CHORUS = /^(chorus|estribillo|coro|refr[aã]o|refrain|hook|ritornello)\b/i;

function performers(voices: Gender[], delivery: Delivery): string {
  const article = (g: Gender) => (g === "male" ? "a male" : "a female");
  if (voices.length === 1) return `performed by ${article(voices[0])} ${ROLE[delivery]} with a new, original voice that doesn't imitate any real artist.`;
  const each = voices.map((g, i) => `Voice ${VOICE_NAMES[i]} is ${article(g)} ${ROLE[delivery]}, ${TIMBRE[i]}`).join("; ");
  return `performed by ${["", "one", "two", "three"][voices.length]} different vocalists trading verses: ${each}. They perform the chorus together. New, original voices that don't imitate any real artist.`;
}

/** With more than one voice, each section tag says who performs it: verses take turns, choruses are together. */
function sectionTag(name: string, verse: number, voices: number): string {
  if (voices < 2) return `[${name}]`;
  const all = VOICE_NAMES.slice(0, voices).join(voices === 2 ? " and " : ", ");
  if (VERSE.test(name)) return `[${name} - Voice ${VOICE_NAMES[verse % voices]}]`;
  if (CHORUS.test(name)) return `[${name} - Voices ${all} together]`;
  return `[${name} - Voices ${all}, alternating lines]`;
}

/**
 * The prompt for Lyria: style direction first, then the lyrics with section tags (the format in
 * Google's music-generation guide, 1 Oct 2026). Real artist names are removed from the style:
 * the model refuses them, and GhostQ never imitates an artist.
 */
export function buildSingPrompt(sheet: SongSheet, vocals: VocalLine): string {
  let production = stripSignalIds(sheet.productionBrief);
  for (const s of sheet.signals) {
    if (s.kind === "artist") production = production.replaceAll(s.label, "").replace(/\s{2,}/g, " ");
  }
  if (vocals.kind === "instrumental") {
    return [`Create an original 2-minute instrumental track. No vocals.`, `Key: ${sheet.key}. Tempo: ${sheet.tempo} BPM. Feel: ${stripSignalIds(sheet.feel)}`, `Production: ${production}`].join("\n");
  }
  let verse = 0;
  const lyrics = sheet.sections
    .map((section) => {
      const tag = sectionTag(section.name, verse, vocals.voices.length);
      if (VERSE.test(section.name)) verse++;
      return [tag, ...section.lines.map((l) => l.text)].join("\n");
    })
    .join("\n\n");
  return [
    `Create an original 2-minute song in ${sheet.language}, ${performers(vocals.voices, vocals.delivery)}`,
    `Key: ${sheet.key}. Tempo: ${sheet.tempo} BPM. Feel: ${stripSignalIds(sheet.feel)}`,
    `Production: ${production}`,
    "",
    "Lyrics:",
    lyrics,
  ].join("\n");
}
