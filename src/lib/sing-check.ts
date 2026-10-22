import type { SongSheet } from "./song-sheet";
import type { VocalLine } from "./voice";

const words = (text: string) => ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `;

/** Asking for someone's voice, whoever they are: "sounds like", "in the style of", "imitate", "the voice of". */
const IMITATION = /\b(sound(?:s|ing)? like|in the (?:style|voice|manner|vein) of|imitat\w*|impersonat\w*|clon(?:e|ed|ing)|voice of|like a young|à la)\b/i;

/**
 * The server's check before Lyria sings (it runs in /api/sing on the SAVED sheet, so a client can't get around it by
 * sending its own): GhostQ never names or imitates a real artist. Null when the song may be sung.
 */
export function singProblem(sheet: SongSheet, vocals: VocalLine): string | null {
  const names = [sheet.artist, ...(sheet.featuring ? [sheet.featuring.artist] : []), ...sheet.signals.filter((s) => s.kind === "artist").map((s) => s.label)].map((n) => n.trim()).filter((n) => n.length >= 3);
  const lyrics = words(sheet.sections.flatMap((s) => s.lines.map((l) => l.text)).join(" "));
  if (names.some((n) => lyrics.includes(words(n)))) return "This song names a real artist in its lyrics, so GhostQ won't sing it.";
  const asked = [vocals.genre, vocals.kind === "vocals" ? vocals.direction : ""].join(" ");
  if (names.some((n) => words(asked).includes(words(n)))) return "Leave artist names out of the genre and vocal direction: GhostQ never imitates a real artist.";
  if (IMITATION.test(asked)) return "Describe the voice itself rather than comparing it to a singer: GhostQ never imitates a real artist.";
  return null;
}
