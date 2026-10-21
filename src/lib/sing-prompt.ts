import type { SongSheet } from "./song-sheet";
import { VOICES, type Voice } from "./voice";

/** Signal ids like "(G2, G4)", "T1" or "[M1]" mean nothing to a music model. */
function stripSignalIds(text: string): string {
  return text
    .replace(/[([]\s*(?:[TSGAMBHC]\d+\s*,?\s*(?:and\s*)?)+[)\]]/g, "")
    .replace(/\b[TSGAMBHC]\d+\b/g, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * The prompt for Lyria: style direction first, then the lyrics with section tags (the format in
 * Google's music-generation guide, 1 Oct 2026). Real artist names are removed from the style:
 * the model refuses them, and GhostQ never imitates an artist.
 */
export function buildSingPrompt(sheet: SongSheet, voice: Voice): string {
  let production = stripSignalIds(sheet.productionBrief);
  for (const s of sheet.signals) {
    if (s.kind === "artist") production = production.replaceAll(s.label, "").replace(/\s{2,}/g, " ");
  }
  const lyrics = sheet.sections.map((section) => [`[${section.name}]`, ...section.lines.map((l) => l.text)].join("\n")).join("\n\n");
  if (voice === "instrumental") {
    return [`Create an original 2-minute instrumental track. No vocals.`, `Key: ${sheet.key}. Tempo: ${sheet.tempo} BPM. Feel: ${stripSignalIds(sheet.feel)}`, `Production: ${production}`].join("\n");
  }
  return [
    `Create an original 2-minute song in ${sheet.language}, sung by ${VOICES[voice].prompt} with a new, original voice that doesn't imitate any real singer.`,
    `Key: ${sheet.key}. Tempo: ${sheet.tempo} BPM. Feel: ${stripSignalIds(sheet.feel)}`,
    `Production: ${production}`,
    "",
    "Lyrics:",
    lyrics,
  ].join("\n");
}
