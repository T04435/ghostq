import type { SongSheet } from "./song-sheet";

const norm = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** One word of a rewritten line, `changed` when the other version doesn't have it there. */
export type DiffWord = { text: string; changed: boolean };

/** Each side's rewritten lines as words, keyed by that side's own "section:line". */
export type LineDiffs = { original: Map<string, DiffWord[]>; remix: Map<string, DiffWord[]> };

/** Two lines word by word: the longest run of words both keep (case and punctuation aside) stays plain; the rest is changed. */
export function wordDiff(before: string, after: string): { before: DiffWord[]; after: DiffWord[] } {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  const na = a.map(norm);
  const nb = b.map(norm);
  // lcs[i][j]: the words a[i..] and b[j..] keep in common.
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = na[i] === nb[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const kept = { a: new Set<number>(), b: new Set<number>() };
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (na[i] === nb[j]) {
      kept.a.add(i++);
      kept.b.add(j++);
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
    else j++;
  }
  return {
    before: a.map((text, i) => ({ text, changed: !kept.a.has(i) })),
    after: b.map((text, j) => ({ text, changed: !kept.b.has(j) })),
  };
}

/** A line's words joined into runs, so a change of several words reads as one mark. */
export function wordRuns(words: DiffWord[]): DiffWord[] {
  const runs: DiffWord[] = [];
  for (const w of words) {
    const last = runs.at(-1);
    if (last && last.changed === w.changed) last.text += ` ${w.text}`;
    else runs.push({ ...w });
  }
  return runs;
}

/**
 * RemixQ: the remix's lines that differ from the original, by position (the writer keeps the sections and their line
 * counts), with both versions word by word. A section the original doesn't have is changed throughout.
 */
export function lineDiffs(original: Pick<SongSheet, "sections">, remix: Pick<SongSheet, "sections">): LineDiffs {
  const out: LineDiffs = { original: new Map(), remix: new Map() };
  remix.sections.forEach((section, s) => {
    const named = original.sections.findIndex((o) => norm(o.name) === norm(section.name));
    const o = named >= 0 ? named : original.sections[s] ? s : -1;
    section.lines.forEach((line, l) => {
      const was = o >= 0 ? original.sections[o].lines[l] : undefined;
      if (was && norm(was.text) === norm(line.text)) return;
      const words = wordDiff(was?.text ?? "", line.text);
      out.remix.set(`${s}:${l}`, words.after);
      if (was) out.original.set(`${o}:${l}`, words.before);
    });
  });
  return out;
}

/** The remix's changed lines ("section:line" keys). */
export function changedLines(original: Pick<SongSheet, "sections">, remix: Pick<SongSheet, "sections">): Set<string> {
  return new Set(lineDiffs(original, remix).remix.keys());
}
