import { namesForIds, withoutArtistNames } from "./signal-text";
import type { SongSheet } from "./song-sheet";
import { VOICE_NAMES, type Gender, type VocalLine } from "./voice";

/** Two or three voices of the same gender need telling apart: the probe of 22 Oct used these and got distinct voices. */
const TIMBRE = ["deeper", "higher", "raspier"];

const VERSE = /^(verse|verso|couplet|strophe|vers)\b/i;
const CHORUS = /^(chorus|estribillo|coro|refr[aã]o|refrain|hook|ritornello)\b/i;

function performers(voices: Gender[]): string {
  if (voices.length === 1) return `one ${voices[0]} vocalist, with a new, original voice that doesn't imitate any real artist`;
  const each = voices.map((g, i) => `Voice ${VOICE_NAMES[i]} is ${g}${voices.filter((v) => v === g).length > 1 ? `, ${TIMBRE[i]}` : ""}`).join("; ");
  return `${["", "one", "two", "three"][voices.length]} different vocalists (${each}), with new, original voices that don't imitate any real artist`;
}

/**
 * With more than one voice, each section tag says who performs it: the writer's choice (section.voices, from 23 Oct);
 * for older sheets, verses take turns and choruses are together.
 */
function sectionTag(name: string, given: string | undefined, verse: number, voices: number): string {
  if (voices < 2) return `[${name}]`;
  if (given?.trim()) return `[${name} - Voice${/and|,|&/.test(given) ? "s" : ""} ${given.trim()}]`;
  const all = VOICE_NAMES.slice(0, voices).join(voices === 2 ? " and " : ", ");
  if (VERSE.test(name)) return `[${name} - Voice ${VOICE_NAMES[verse % voices]}]`;
  if (CHORUS.test(name)) return `[${name} - Voices ${all} together]`;
  return `[${name} - Voices ${all}, alternating lines]`;
}

/**
 * The prompt for Lyria: genre, voices and vocal direction first, then the style, then the lyrics with section tags
 * (the format in Google's music-generation guide, 1 Oct 2026). Signal ids become their Qloo names; real artists are
 * removed (the model refuses them, and GhostQ never imitates an artist). `vocals.genre` and `vocals.direction` are the
 * writer's, as the user left them before singing.
 */
export function buildSingPrompt(sheet: SongSheet, vocals: VocalLine): string {
  const artists = [sheet.artist, ...sheet.signals.filter((s) => s.kind === "artist").map((s) => s.label)];
  const clean = (text: string) => withoutArtistNames(namesForIds(text, sheet.signals), artists);
  const genre = clean(vocals.genre || sheet.genre);
  const style = [`Key: ${sheet.key}. Tempo: ${sheet.tempo} BPM. Feel: ${clean(sheet.feel)}`, `Production: ${clean(sheet.productionBrief)}`];
  if (vocals.kind === "instrumental") {
    return [`Create an original 2-minute instrumental ${genre ? `${genre} ` : ""}track. No vocals.`, ...style].join("\n");
  }
  let verse = 0;
  const lyrics = sheet.sections
    .map((section) => {
      const tag = sectionTag(section.name, section.voices, verse, vocals.voices.length);
      if (VERSE.test(section.name)) verse++;
      return [tag, ...section.lines.map((l) => l.text)].join("\n");
    })
    .join("\n\n");
  const direction = clean(vocals.direction || sheet.vocalDirection);
  return [
    `Create an original 2-minute song in ${sheet.language}${genre ? `. Genre: ${genre}` : ""}.`,
    `Performed by ${performers(vocals.voices)}.`,
    direction ? `Vocals: ${direction}` : "",
    ...style,
    "",
    "Lyrics:",
    lyrics,
  ]
    .filter((l, i) => l !== "" || i > 2)
    .join("\n");
}
