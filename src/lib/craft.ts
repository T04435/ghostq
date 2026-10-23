import type { Problem } from "./validate-sheet";
import type { WrittenSong } from "./song-sheet";
import { sectionKind } from "./chords";

/**
 * The lyric craft rules, checked in code after the song is written: matching syllable counts between verses, a rhyme in
 * every section, the hook (the title) on the chorus's first or last line, and no filler. Lines that fail go back to the
 * writer on their own; the rest of the song stays.
 */

const VOWELS = /[aeiouyàáâãäåæèéêëìíîïòóôõöøùúûüÿœ]+/giu;

/** Syllables, by vowel groups: rough, but even across English, Spanish and Portuguese. */
export function syllables(text: string): number {
  return text
    .toLowerCase()
    .split(/[^\p{L}']+/u)
    .filter(Boolean)
    .reduce((n, word) => {
      let groups = (word.match(VOWELS) ?? []).length;
      // English silent e ("home", "made"), but not "the" or "be".
      if (groups > 1 && /[^aeiouyl]e$/.test(word)) groups--;
      return n + Math.max(1, groups);
    }, 0);
}

/** What a line's last word rhymes on: its last vowel group and what follows ("light" → "ight", "corazón" → "on"). */
export function rhymeKey(line: string): string {
  const word = (line.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").match(/\p{L}+/gu) ?? []).at(-1) ?? "";
  // A silent final e ("here", "one", "home") rhymes on the vowel before it.
  const silent = word.length > 2 && /[^aeiouy]e$/.test(word);
  const stem = silent ? word.slice(0, -1) : word;
  const m = stem.match(/[aeiouy]+[^aeiouy]*$/);
  return (m ? m[0].replace(/^[aeiou]*([aeiouy])/, "$1") : stem) + (silent ? "e" : "");
}

/** Whether two lines rhyme: same ending, or the same last vowel (assonance, as Spanish and Portuguese songs rhyme). */
export function rhymes(a: string, b: string): boolean {
  const ka = rhymeKey(a);
  const kb = rhymeKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const vowel = (k: string) => k.match(/[aeiouy]/)?.[0];
  const tail = (k: string) => k.replace(/^[aeiouy]+/, "");
  return vowel(ka) === vowel(kb) && (tail(ka) === tail(kb) || ka.length <= 2 || kb.length <= 2);
}

const FILLER = /\b(oh(?:[\s,]+oh)+|yeah(?:[\s,]+yeah)+|na(?:[\s,]+na)+|la(?:[\s,]+la)+|whoa+|ooh+|baby(?:[\s,]+baby)+|uh(?:[\s,]+huh)?)\b/i;

const words = (t: string) => ` ${t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ")} `;

export type CraftProblem = Problem & { section: number; line: number };

/** Where to stop: past this many syllables a sung line crowds the melody (rap runs longer, so it isn't capped). */
const MAX_SUNG = 22;
const VERSE_SLACK = 4;
/** At most this many lines go back per pass: the rest of the song stays as written. */
export const MAX_CRAFT_FIXES = 6;

export function craftProblems(song: Pick<WrittenSong, "title" | "sections" | "genre" | "vocalDirection">): CraftProblem[] {
  const rapped = /\b(rap|rapped|rapping|hip[ -]?hop|spoken)\b/i.test(`${song.genre} ${song.vocalDirection}`);
  const problems: CraftProblem[] = [];
  const add = (section: number, line: number, issue: string) => problems.push({ section, line, where: `${song.sections[section].name}, line ${line + 1}`, issue });

  // Filler and length.
  song.sections.forEach((s, si) =>
    s.lines.forEach((l, li) => {
      if (FILLER.test(l.text)) add(si, li, "is filler (vocables or repeated words); give it an image or a point");
      const n = syllables(l.text);
      if (!rapped && n > MAX_SUNG) add(si, li, `is too long to sing (${n} syllables); keep it under ${MAX_SUNG - 4}`);
    }),
  );

  // Verses of one kind match their first's syllable count line by line (within 3), so the melody fits both.
  const firstOf = new Map<string, number>();
  song.sections.forEach((s, si) => {
    const kind = sectionKind(s.name);
    if (!kind.startsWith("verse") && !kind.startsWith("pre-chorus")) return;
    const first = firstOf.get(kind);
    if (first === undefined) return void firstOf.set(kind, si);
    s.lines.forEach((l, li) => {
      const ref = song.sections[first].lines[li];
      if (!ref) return;
      const a = syllables(ref.text);
      const b = syllables(l.text);
      if (Math.abs(a - b) > (rapped ? VERSE_SLACK + 3 : VERSE_SLACK)) add(si, li, `has ${b} syllables where ${song.sections[first].name} line ${li + 1} has ${a}; match it within ${VERSE_SLACK}`);
    });
  });

  // Every section of 3+ lines rhymes somewhere; a line that rhymes with nothing ends the section is the one to fix.
  song.sections.forEach((s, si) => {
    if (s.lines.length < 3) return;
    const t = s.lines.map((l) => l.text);
    const any = t.some((a, i) => t.some((b, j) => j > i && rhymes(a, b)));
    if (!any) add(si, t.length - 1, "the section doesn't rhyme anywhere; make this line rhyme with an earlier one");
  });

  // The hook: the title's words on the chorus's first or last line.
  const chorus = song.sections.findIndex((s) => sectionKind(s.name).startsWith("chorus"));
  if (chorus >= 0) {
    const lines = song.sections[chorus].lines;
    // Most of the title's words (the short ones aside) on one line counts: "the glow on the Shore Road" carries "Last
    // Light on the Shore Road".
    const key = words(song.title.replace(/\(.*?\)/g, "")).trim().split(" ").filter((w) => w.length > 3);
    const has = (t: string) => !key.length || key.filter((w) => words(t).includes(` ${w} `)).length * 2 >= key.length;
    if (!has(lines[0].text) && !has(lines.at(-1)!.text)) add(chorus, 0, `doesn't carry the hook: put the title ("${song.title}") on the chorus's first or last line`);
  }

  // The hook first, then filler, then the rest, in song order.
  const rank = (p: CraftProblem) => (p.issue.includes("hook") ? 0 : p.issue.includes("filler") ? 1 : 2);
  return problems.sort((a, b) => rank(a) - rank(b) || a.section - b.section || a.line - b.line);
}
