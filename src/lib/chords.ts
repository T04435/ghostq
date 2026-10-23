import type { Problem } from "./validate-sheet";
import type { WrittenSong } from "./song-sheet";

/**
 * Chords, checked in code: every chord fits the key (or is a common borrowed chord), and repeated sections repeat their
 * progression. Plus the ChordPro export.
 */

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE: Record<string, number> = { Cb: 11, "B#": 0, "E#": 5, Fb: 4 };
SHARPS.forEach((n, i) => (NOTE[n] = i));
FLATS.forEach((n, i) => (NOTE[n] = i));

type Quality = "maj" | "min" | "dim" | "other";
export type Chord = { root: number; quality: Quality; text: string };
export type Key = { tonic: number; minor: boolean; flats: boolean };

/** Keys written with flats: Db, Eb, F, Ab, Bb major; D, G, C, F, Bb, Eb minor (the rest with sharps). */
function prefersFlats(tonic: number, minor: boolean): boolean {
  return (minor ? [2, 7, 0, 5, 10, 3] : [1, 3, 5, 8, 10]).includes(tonic);
}

/** "A minor", "F# major", "Bbm", "D": null when it doesn't read as a key. */
export function parseKey(text: string): Key | null {
  const m = text.trim().match(/^([A-G])([#b♯♭]?)\s*(m(?:in(?:or)?)?|maj(?:or)?|major|minor)?\b/i);
  if (!m) return null;
  const name = m[1].toUpperCase() + m[2].replace("♯", "#").replace("♭", "b");
  const tonic = NOTE[name];
  if (tonic === undefined) return null;
  const minor = /^m(in)?/i.test(m[3] ?? "") && !/^maj/i.test(m[3] ?? "");
  return { tonic, minor, flats: m[2] === "b" || m[2] === "♭" || (!m[2] && prefersFlats(tonic, minor)) };
}

/** "F#m7/C#" → root F#, minor. Extensions (7, maj7, sus, add9) and the slash bass don't change what it is. */
export function parseChord(text: string): Chord | null {
  const m = text.trim().match(/^([A-G])([#b♯♭]?)(.*)$/);
  if (!m) return null;
  const root = NOTE[m[1] + m[2].replace("♯", "#").replace("♭", "b")];
  if (root === undefined) return null;
  const rest = m[3].split("/")[0];
  const quality: Quality = /^(dim|°|m7b5|ø)/.test(rest) ? "dim" : /^m(?!aj)/.test(rest) ? "min" : /^(sus|5)/.test(rest) ? "other" : "maj";
  return { root, quality, text: text.trim() };
}

/** The chords in a line's chord string ("Am  F  C  G", "| Am | F |"). */
export function chordsIn(line: string): Chord[] {
  return line
    .split(/[\s|,–-]+/)
    .filter(Boolean)
    .map(parseChord)
    .filter((c): c is Chord => c !== null);
}

// Scale degrees (semitones from the tonic) and their triad qualities, plus the borrowed chords a songwriter reaches for.
const MAJOR: [number, Quality][] = [[0, "maj"], [2, "min"], [4, "min"], [5, "maj"], [7, "maj"], [9, "min"], [11, "dim"]];
const MAJOR_BORROWED: [number, Quality][] = [[10, "maj"], [8, "maj"], [3, "maj"], [5, "min"], [2, "maj"], [4, "maj"], [9, "maj"]];
const MINOR: [number, Quality][] = [[0, "min"], [2, "dim"], [3, "maj"], [5, "min"], [7, "min"], [8, "maj"], [10, "maj"]];
const MINOR_BORROWED: [number, Quality][] = [[7, "maj"], [5, "maj"], [0, "maj"], [11, "dim"], [2, "min"], [1, "maj"]];

/** Whether a chord belongs to the key or is a common borrowed chord. Sus and power chords pass on their root. */
export function fitsKey(chord: Chord, key: Key): boolean {
  const degree = (chord.root - key.tonic + 12) % 12;
  const allowed = key.minor ? [...MINOR, ...MINOR_BORROWED] : [...MAJOR, ...MAJOR_BORROWED];
  if (chord.quality === "other") return allowed.some(([d]) => d === degree);
  return allowed.some(([d, q]) => d === degree && (q === chord.quality || (q === "dim" && chord.quality === "min")));
}

/** "Verse 2" → "verse", "Final Chorus" → "chorus": sections of one kind repeat their progression. */
export function sectionKind(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(final|last|first|second|third|outro|intro)\b/g, (w) => (w === "outro" || w === "intro" ? w : ""))
    .replace(/[^a-z-]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

/** A section's progression: its chords in order, repeats within a line collapsed. */
export function progression(section: Pick<WrittenSong["sections"][number], "lines">): string[] {
  return section.lines.flatMap((l) => chordsIn(l.chords).map((c) => `${c.root}:${c.quality}`));
}

/** The chord rules, as problems for the writer's repair pass (same shape as the receipt rules). */
export function chordProblems(song: Pick<WrittenSong, "key" | "sections">): Problem[] {
  const key = parseKey(song.key);
  const problems: Problem[] = [];
  if (!key) return [{ where: "Key", issue: `"${song.key}" isn't a key; write it like "A minor" or "F# major"` }];
  song.sections.forEach((section, si) => {
    section.lines.forEach((line, li) => {
      const where = `${section.name || `Section ${si + 1}`}, line ${li + 1}`;
      if (!chordsIn(line.chords).length) problems.push({ where, issue: `has no chords ("${line.chords}")` });
      const off = chordsIn(line.chords).filter((c) => !fitsKey(c, key));
      if (off.length) problems.push({ where, issue: `chord ${off.map((c) => c.text).join(", ")} isn't in ${song.key} (or a common borrowed chord)` });
    });
  });
  const first = new Map<string, { name: string; prog: string[] }>();
  for (const section of song.sections) {
    const kind = sectionKind(section.name);
    const prog = progression(section);
    const seen = first.get(kind);
    if (!seen) first.set(kind, { name: section.name, prog });
    else if (seen.prog.slice(0, 4).join() !== prog.slice(0, 4).join()) problems.push({ where: section.name, issue: `repeats ${seen.name}, so it repeats its chord progression` });
  }
  return problems;
}

/** The song as ChordPro: {title}, {key}, {tempo}, sections as comments, each chord inline before its line. */
export function toChordPro(song: Pick<WrittenSong, "title" | "key" | "tempo" | "sections"> & { artist?: string }): string {
  const out = [`{title: ${song.title}}`, ...(song.artist ? [`{subtitle: GhostQ draft for ${song.artist}}`] : []), `{key: ${song.key}}`, `{tempo: ${song.tempo}}`, ""];
  for (const section of song.sections) {
    out.push(`{comment: ${section.name}}`);
    for (const line of section.lines) {
      const chords = chordsIn(line.chords);
      // Spread the chords over the line's words in order (the sheet doesn't say which syllable each falls on).
      const words = line.text.split(" ");
      const at = new Map<number, string>();
      chords.forEach((c, i) => {
        const w = Math.min(words.length - 1, Math.floor((i * words.length) / chords.length));
        at.set(w, (at.get(w) ?? "") + `[${c.text}]`);
      });
      out.push(words.map((w, i) => (at.get(i) ?? "") + w).join(" "));
    }
    out.push("");
  }
  return out.join("\n");
}
